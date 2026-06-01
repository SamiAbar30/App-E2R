import { Request, Response, NextFunction } from 'express';
import { Rating } from '../models/Rating';
import { ApiLog } from '../models/ApiLog';
import { AdditiveDictionary } from '../models/AdditiveDictionary';
import { UserScan } from '../models/UserScan';

/**
 * Controller to fetch dashboard statistics.
 * GET /api/v1/admin/stats
 */
export const getStatsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const totalScans = await UserScan.countDocuments();
    const totalLogs = await ApiLog.countDocuments();
    
    const ratingsAgg = await Rating.aggregate([
      { $group: { _id: null, avgRating: { $avg: '$rating' } } }
    ]);
    const averageRating = ratingsAgg.length > 0 ? ratingsAgg[0].avgRating : 0;
    
    // For active users we can count distinct userIds in ApiLogs over the last 30 days
    const activeUsersAgg = await ApiLog.distinct('userId');
    const activeUsers = activeUsersAgg.length;

    res.status(200).json({
      status: 'ok',
      data: {
        totalScans,
        totalLogs,
        averageRating,
        activeUsers,
      },
      code: 200,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller to fetch all ratings.
 * GET /api/v1/admin/ratings
 */
export const getRatingsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const ratings = await Rating.find().sort({ createdAt: -1 }).limit(100);
    res.status(200).json({
      status: 'ok',
      data: ratings,
      code: 200,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller to fetch the additive dictionary.
 * GET /api/v1/admin/dictionary
 */
export const getDictionaryHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const dictionary = await AdditiveDictionary.find().sort({ eNumber: 1 });
    res.status(200).json({
      status: 'ok',
      data: dictionary,
      code: 200,
    });
  } catch (error) {
    next(error);
  }
};
