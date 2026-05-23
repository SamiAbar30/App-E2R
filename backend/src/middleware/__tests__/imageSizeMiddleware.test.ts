import { Request, Response, NextFunction } from 'express';
import { imageSizeMiddleware } from '../imageSizeMiddleware';
import { env } from '../../config/env';

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

  it('should pass exactly under-limit payload', () => {
    // Generate a payload that computes to under MAX_IMAGE_BYTES
    const bytes = env.MAX_IMAGE_BYTES - 100;
    const stringLength = Math.floor((bytes * 4) / 3) - 2;
    const payload = 'A'.repeat(stringLength) + '=='; 
    mockReq = {
      body: { imagePayload: payload }
    };

    imageSizeMiddleware(mockReq as Request, mockRes as Response, nextFunction);

    expect(nextFunction).toHaveBeenCalled();
    expect(mockStatus).not.toHaveBeenCalled();
  });

  it('should reject >= MAX_IMAGE_BYTES payload with 400 INVALID_IMAGE', () => {
    // Generate a payload that computes to over MAX_IMAGE_BYTES
    const bytes = env.MAX_IMAGE_BYTES + 100;
    const stringLength = Math.ceil((bytes * 4) / 3);
    const payload = 'A'.repeat(stringLength);
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
