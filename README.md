# 📱 TFM: Easy-to-Read Label Scanner

![Accessibility](https://img.shields.io/badge/Accessibility-WCAG_2.1_AA-blue.svg)
![React Native](https://img.shields.io/badge/React_Native-0.81-61DAFB?logo=react&logoColor=black)
![Node.js](https://img.shields.io/badge/Node.js-20-339933?logo=node.js&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi&logoColor=white)

**Design and Implementation of a Mobile App and Server Architecture for Everyday Texts in Easy-to-Read**

An end-to-end accessibility solution designed for users with cognitive accessibility needs. The application scans food ingredient labels via Optical Character Recognition (OCR) and adapts them into an Easy-to-Read (Lectura Fácil) format using advanced NLP services (FACILE).

## ✨ Key Features

- **📷 Smart Camera Capture:** Real-time label scanning with adaptive lighting and focus feedback.
- **🔍 Advanced OCR Extraction:** Powered by a deep learning PaddleOCR microservice optimized for cylindrical product packaging (anti-column bleeding heuristic).
- **🛡️ Allergen & Additive Detection:** Automatically detects critical food data, cross-referencing ingredients against a comprehensive additive dictionary.
- **🎚️ NLP Pruning Engine:** Features a difficulty slider allowing dynamic simplification of complex scientific ingredient terms.
- **♿ Fully Accessible UI:** Strict adherence to WCAG 2.1 AA guidelines, featuring a high-contrast palette and screen reader support.

## 🏗️ Architecture

The project consists of three loosely coupled tiers:

1. **📱 Mobile App (`/mobile`)**
   - **Framework:** React Native (0.81) + Expo (54)
   - **State Management:** Zustand with secure offline persistence via AsyncStorage.
   - **Styling:** Custom StyleSheet architecture targeting an accessible `#2b2d42`, `#ef233c`, `#f8f9fa`, `#8d99ae` palette.

2. **⚙️ Backend API (`/backend`)**
   - **Environment:** Node.js 20 + Express 4
   - **Database:** MongoDB 8 / Mongoose
   - **Responsibilities:** Orchestrates the processing pipeline (Allergen mapping -> NLP Pruning -> FACILE Simplification).

3. **👁️ OCR Microservice (`/ocr_service`)**
   - **Environment:** Python + FastAPI
   - **AI Provider:** PaddleOCR (PP-OCRv5)
   - **Responsibilities:** Sidecar service exposing a single robust endpoint for extracting text from base64 images, equipped with spatial reconstruction heuristics.

## 🚀 Quick Start

### 1. Backend Server
Ensure you have Node.js 20+ and a MongoDB instance running.
```bash
cd backend
npm install
# Set up your .env file
npm run dev     # Runs on http://localhost:3000
```

### 2. OCR Microservice
Requires Python 3.10+.
```bash
cd ocr_service
pip install -r requirements.txt
python main.py  # Runs on http://localhost:8100
```

### 3. Mobile App
Requires Node.js 20+ and Expo CLI.
```bash
cd mobile
npm install
npm start       # Starts the Expo dev server
```

## 🧩 Pipeline Workflow

1. **Capture:** Mobile app captures the food label.
2. **Extraction:** Base64 image is sent to the OCR microservice. AI-driven text recognition and spatial reconstruction retrieve the raw text.
3. **Parsing:** The Node.js backend parses quantities, detects allergens, and translates E-numbers (additives).
4. **Simplification:** The NLP Pruning engine dynamically simplifies terminology based on the user's difficulty slider settings, querying the FACILE integration.
5. **Rendering:** The adapted text is sent back to the mobile app and rendered through the `AccessibleLabelRenderer`.

## 🧪 Testing

Comprehensive testing suites are configured across the stack:
- **Backend:** Run `npm test` for Jest + Supertest suites.
- **Mobile:** Run `npm test` for Jest + jest-expo suites.

## 📄 License
*Part of the Master's Thesis (TFM) at Universidad Politécnica de Madrid (UPM) | MUSS.*
