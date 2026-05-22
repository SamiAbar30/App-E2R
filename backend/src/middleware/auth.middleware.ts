import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    iat: number;
    exp: number;
  };
}

export function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      status: 'error',
      errorCode: 'UNAUTHORIZED',
      message: 'Missing or malformed Authorization header'
    });
    return;
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    res.status(401).json({
      status: 'error',
      errorCode: 'UNAUTHORIZED',
      message: 'Empty bearer token'
    });
    return;
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as {
      userId: string;
      iat: number;
      exp: number;
    };
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({
      status: 'error',
      errorCode: 'UNAUTHORIZED',
      message: 'Invalid or expired token'
    });
  }
}
