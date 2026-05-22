import { Request, Response, NextFunction } from 'express';
import { imageSizeMiddleware } from '../imageSizeMiddleware';

describe('imageSizeMiddleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let nextFunction: NextFunction;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;

  beforeEach(() => {
    mockJson = jest.fn();
    mockStatus = jest.fn().mockReturnValue({ json: mockJson });
    mockRes = {
      status: mockStatus,
    };
    nextFunction = jest.fn();
  });

  it('should pass exactly 2,097,151 bytes payload', () => {
    // Generate a payload that exactly computes to 2,097,151 bytes when decoded.
    // Length in base64: L = (bytes * 4) / 3
    // 2,097,151 * 4 / 3 = 2796201.33 -> 2796204 chars (with padding).
    const stringLength = 2796202; // A bit under the limit 
    const payload = 'A'.repeat(stringLength) + '=='; 
    mockReq = {
      body: { imagePayload: payload }
    };

    imageSizeMiddleware(mockReq as Request, mockRes as Response, nextFunction);

    expect(nextFunction).toHaveBeenCalled();
    expect(mockStatus).not.toHaveBeenCalled();
  });

  it('should reject >= 2,097,152 bytes (2.0 MB) payload with 400 INVALID_IMAGE', () => {
    // Length in base64 for 2MB: (2097152 * 4) / 3 = 2796202.66 -> 2796204 chars
    // So 2,796,205 chars is definitely >= 2MB
    const payload = 'A'.repeat(2796205) + '=';
    mockReq = {
      body: { imagePayload: payload }
    };

    imageSizeMiddleware(mockReq as Request, mockRes as Response, nextFunction);

    expect(nextFunction).toHaveBeenCalledWith(expect.objectContaining({
      name: 'InvalidImageError',
      statusCode: 400,
      errorCode: 'INVALID_IMAGE'
    }));
    expect(mockStatus).not.toHaveBeenCalled();
  });

  it('should reject if imagePayload is missing', () => {
    mockReq = {
      body: {}
    };

    imageSizeMiddleware(mockReq as Request, mockRes as Response, nextFunction);

    expect(nextFunction).toHaveBeenCalledWith(expect.objectContaining({
      name: 'InvalidImageError',
      statusCode: 400
    }));
    expect(mockStatus).not.toHaveBeenCalled();
  });

  it('should pass correctly formatted base64 with data URL prefix under limit', () => {
    const payload = 'data:image/jpeg;base64,' + 'A'.repeat(100);
    mockReq = {
      body: { imagePayload: payload }
    };

    imageSizeMiddleware(mockReq as Request, mockRes as Response, nextFunction);

    expect(nextFunction).toHaveBeenCalled();
  });
});
