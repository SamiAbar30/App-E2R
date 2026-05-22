import { Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../auth.middleware';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';

// Mock env.JWT_SECRET just to be safe, though it should be loaded
jest.mock('../../config/env', () => ({
  env: {
    JWT_SECRET: 'test-secret'
  }
}));

describe('authMiddleware (auth.middleware.ts)', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let nextFunction: NextFunction;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;

  beforeEach(() => {
    mockJson = jest.fn();
    mockStatus = jest.fn().mockReturnValue({ json: mockJson });
    mockReq = {
      headers: {}
    };
    mockRes = {
      status: mockStatus
    };
    nextFunction = jest.fn();
  });

  it('should pass with a valid JWT signature', () => {
    const validToken = jwt.sign({ userId: '123', role: 'user' }, 'test-secret');
    mockReq.headers = {
      authorization: `Bearer ${validToken}`
    };

    authMiddleware(mockReq as Request, mockRes as Response, nextFunction);

    expect(nextFunction).toHaveBeenCalledWith();
    expect((mockReq as any).user.userId).toBe('123');
  });

  it('should throw UnauthorizedError on missing Bearer prefix', () => {
    mockReq.headers = {
      authorization: 'InvalidToken123'
    };

    authMiddleware(mockReq as Request, mockRes as Response, nextFunction);
    
    expect(nextFunction).not.toHaveBeenCalled();
    expect(mockStatus).toHaveBeenCalledWith(401);
  });

  it('should throw UnauthorizedError on expired token', () => {
    // Create an expired token (expires in -10 seconds)
    const expiredToken = jwt.sign({ userId: '123' }, 'test-secret', { expiresIn: '-10s' });
    mockReq.headers = {
      authorization: `Bearer ${expiredToken}`
    };

    authMiddleware(mockReq as Request, mockRes as Response, nextFunction);

    expect(nextFunction).not.toHaveBeenCalled();
    expect(mockStatus).toHaveBeenCalledWith(401);
  });

  it('should throw UnauthorizedError if no authorization header is present', () => {
    mockReq.headers = {};

    authMiddleware(mockReq as Request, mockRes as Response, nextFunction);

    expect(nextFunction).not.toHaveBeenCalled();
    expect(mockStatus).toHaveBeenCalledWith(401);
  });
});
