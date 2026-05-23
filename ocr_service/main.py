"""
PaddleOCR FastAPI Microservice — Self-Hosted PP-OCRv5 Sidecar Tier.

Exposes a single POST /v1/ocr/extract endpoint that accepts a Base64-encoded
image, runs PaddleOCR inference with Spanish language support and angle
classification, applies a spatial reconstruction heuristic to handle curved
cylindrical multi-column product labels, and returns clean normalized text.

IEEE 29148 trace: FR-OCR-001, NFR-PERF-002, NFR-EXT-001
"""

from __future__ import annotations

import base64
import logging
import re
import sys
from contextlib import asynccontextmanager
from io import BytesIO
from typing import Any

import cv2
import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from paddleocr import PaddleOCR

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    stream=sys.stdout,
)
logger = logging.getLogger("ocr_service")

# ---------------------------------------------------------------------------
# Global OCR engine instance (initialized once at startup)
# ---------------------------------------------------------------------------
ocr_engine: PaddleOCR | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan handler.
    Initializes the PaddleOCR engine once at startup so that the heavy model
    loading cost is paid only once, not per-request.
    """
    global ocr_engine
    logger.info("Initializing PaddleOCR engine (PP-OCRv5, lang=es, angle_cls=True)…")
    ocr_engine = PaddleOCR(
        use_textline_orientation=True,
        lang="es",
        ocr_version="PP-OCRv3"
    )
    logger.info("PaddleOCR engine ready.")
    yield
    logger.info("Shutting down OCR service.")
    ocr_engine = None


# ---------------------------------------------------------------------------
# FastAPI Application
# ---------------------------------------------------------------------------
app = FastAPI(
    title="PaddleOCR Microservice",
    description="Self-hosted OCR sidecar for the TFM Easy-to-Read pipeline.",
    version="1.0.0",
    lifespan=lifespan,
)


# ---------------------------------------------------------------------------
# Request / Response Schemas
# ---------------------------------------------------------------------------
class OcrRequest(BaseModel):
    """Inbound contract: raw Base64-encoded image string."""
    imagePayload: str = Field(
        ...,
        min_length=1,
        description="Raw Base64-encoded image (no data-URI prefix expected).",
    )


class OcrSuccessResponse(BaseModel):
    """Outbound contract for successful extraction."""
    status: str = "success"
    rawText: str


class OcrErrorResponse(BaseModel):
    """Outbound contract for processing failures."""
    status: str = "error"
    errorCode: str = "PROCESSING_FAILED"
    message: str


# ---------------------------------------------------------------------------
# Spatial Reconstruction Heuristic (Anti-Column Bleeding)
# ---------------------------------------------------------------------------
def _reconstruct_spatial_order(
    ocr_results: list[list[Any]],
) -> str:
    """
    Rebuild reading order from raw PaddleOCR bounding-box output.

    Product labels on cylindrical packaging often wrap text in curved columns.
    The raw OCR output can interleave fragments from different columns.  This
    heuristic:

      1. Extracts the vertical midpoint (y_mid) and horizontal start (x_min)
         of every detected text fragment.
      2. Sorts all fragments top-to-bottom by y_mid.
      3. Clusters fragments whose y_mid values are within a dynamic threshold
         (40 % of median line height) into the same logical row.
      4. Within each row, sorts fragments left-to-right by x_min.
      5. Joins intra-row fragments with a single space, and rows with newlines.

    Returns a single normalized string.
    """
    if not ocr_results or not ocr_results[0]:
        return ""

    fragments: list[dict[str, Any]] = []
    for line in ocr_results[0]:
        bbox = line[0]  # [[x0,y0],[x1,y1],[x2,y2],[x3,y3]]
        text = line[1][0]  # detected text string
        confidence = line[1][1]  # confidence score

        if not text or not text.strip():
            continue

        # Compute bounding box geometry
        ys = [pt[1] for pt in bbox]
        xs = [pt[0] for pt in bbox]
        y_mid = sum(ys) / len(ys)
        x_min = min(xs)
        height = max(ys) - min(ys)

        fragments.append({
            "text": text.strip(),
            "y_mid": y_mid,
            "x_min": x_min,
            "height": height,
            "confidence": confidence,
        })

    if not fragments:
        return ""

    # Sort top-to-bottom by vertical midpoint
    fragments.sort(key=lambda f: f["y_mid"])

    # Compute dynamic clustering threshold: 40% of median line height
    heights = sorted(f["height"] for f in fragments if f["height"] > 0)
    if heights:
        median_height = heights[len(heights) // 2]
        row_threshold = median_height * 0.40
    else:
        row_threshold = 10.0

    # Cluster into logical rows
    rows: list[list[dict[str, Any]]] = []
    current_row: list[dict[str, Any]] = [fragments[0]]

    for frag in fragments[1:]:
        if abs(frag["y_mid"] - current_row[-1]["y_mid"]) <= row_threshold:
            current_row.append(frag)
        else:
            rows.append(current_row)
            current_row = [frag]
    rows.append(current_row)

    # Within each row, sort left-to-right by horizontal start position
    reconstructed_lines: list[str] = []
    for row in rows:
        row.sort(key=lambda f: f["x_min"])
        line_text = " ".join(f["text"] for f in row)
        reconstructed_lines.append(line_text)

    return "\n".join(reconstructed_lines)


# ---------------------------------------------------------------------------
# String Normalization
# ---------------------------------------------------------------------------
def _normalize_text(raw: str) -> str:
    """
    Collapse multiple whitespace into single spaces, strip control characters,
    and return a clean trimmed string.
    """
    # Remove ASCII control characters (0x00–0x1F, 0x7F) except newline/tab
    cleaned = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", raw)
    # Collapse runs of whitespace (including multiple spaces/tabs) to single space
    cleaned = re.sub(r"[ \t]+", " ", cleaned)
    # Collapse multiple blank lines into a single newline
    cleaned = re.sub(r"\n{2,}", "\n", cleaned)
    # Final trim
    return cleaned.strip()


# ---------------------------------------------------------------------------
# Extraction Endpoint
# ---------------------------------------------------------------------------
@app.post(
    "/v1/ocr/extract",
    response_model=OcrSuccessResponse,
    responses={
        422: {"model": OcrErrorResponse, "description": "Image processing failed"},
    },
    summary="Extract text from a Base64-encoded image via PaddleOCR.",
)
async def extract_text(request: OcrRequest) -> JSONResponse:
    """
    Accept a Base64-encoded image, decode it into an OpenCV matrix,
    run PaddleOCR inference, apply spatial reconstruction and normalization,
    and return the extracted text.
    """
    global ocr_engine

    if ocr_engine is None:
        return JSONResponse(
            status_code=503,
            content={
                "status": "error",
                "errorCode": "ENGINE_NOT_READY",
                "message": "OCR engine has not finished initialization.",
            },
        )

    # ── Step 1: Base64 decode → OpenCV image matrix ──────────────────────
    try:
        # Strip optional data-URI prefix if present
        payload = request.imagePayload
        if "," in payload:
            payload = payload.split(",", 1)[1]

        image_bytes = base64.b64decode(payload, validate=True)
        nparr = np.frombuffer(image_bytes, dtype=np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None:
            raise ValueError("cv2.imdecode returned None — corrupt or unsupported image format.")

    except Exception as exc:
        logger.warning("Image decode failed: %s", exc)
        return JSONResponse(
            status_code=422,
            content={
                "status": "error",
                "errorCode": "PROCESSING_FAILED",
                "message": f"Image decoding error: {exc}",
            },
        )

    # ── Step 2: PaddleOCR inference ──────────────────────────────────────
    try:
        logger.info("Running PaddleOCR inference (image shape: %s)…", img.shape)
        results = ocr_engine.ocr(img)
        logger.info("Inference complete — %d result group(s).", len(results) if results else 0)

    except Exception as exc:
        logger.error("OCR inference failed: %s", exc, exc_info=True)
        return JSONResponse(
            status_code=422,
            content={
                "status": "error",
                "errorCode": "PROCESSING_FAILED",
                "message": f"OCR inference error: {exc}",
            },
        )

    # ── Step 3: Spatial reconstruction ───────────────────────────────────
    try:
        raw_text = _reconstruct_spatial_order(results)
    except Exception as exc:
        logger.error("Spatial reconstruction failed: %s", exc, exc_info=True)
        return JSONResponse(
            status_code=422,
            content={
                "status": "error",
                "errorCode": "PROCESSING_FAILED",
                "message": f"Text reconstruction error: {exc}",
            },
        )

    # ── Step 4: String normalization ─────────────────────────────────────
    normalized = _normalize_text(raw_text)

    if not normalized:
        logger.warning("No text detected in image after normalization.")
        return JSONResponse(
            status_code=422,
            content={
                "status": "error",
                "errorCode": "PROCESSING_FAILED",
                "message": "No text detected in the provided image.",
            },
        )

    logger.info("Extraction successful — %d characters.", len(normalized))
    return JSONResponse(
        status_code=200,
        content={
            "status": "success",
            "rawText": normalized,
        },
    )


# ---------------------------------------------------------------------------
# Health Check
# ---------------------------------------------------------------------------
@app.get("/health", summary="Liveness probe.")
async def health_check():
    return {"status": "ok", "engine_ready": ocr_engine is not None}


# ---------------------------------------------------------------------------
# Entrypoint (for direct execution / debugging)
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8100,
        workers=1,
        log_level="info",
    )
