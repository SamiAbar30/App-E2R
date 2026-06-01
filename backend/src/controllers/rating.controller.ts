import { Request, Response, NextFunction } from 'express';
import { Rating } from '../models/Rating';

/**
 * Controller to handle submission of user feedback ratings.
 * POST /api/v1/ratings
 */
export const submitRatingHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { scanId, rating, feedback } = req.body;

    if (rating === undefined || typeof rating !== 'number' || rating < 1 || rating > 5) {
      res.status(400).json({
        status: 'error',
        data: null,
        code: 'BAD_REQUEST',
        message: 'Rating must be a number between 1 and 5.',
      });
      return;
    }

    const newRating = new Rating({
      scanId,
      rating,
      feedback,
    });

    await newRating.save();

    res.status(201).json({
      status: 'ok',
      data: {
        id: newRating._id,
        createdAt: newRating.createdAt,
      },
      code: 201,
    });
  } catch (error) {
    next(error);
  }
};
