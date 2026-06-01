import mongoose, { Schema, Document } from 'mongoose';

export interface IRating extends Document {
  scanId?: string;
  rating: number;
  feedback?: string;
  createdAt: Date;
  updatedAt: Date;
}

const RatingSchema = new Schema(
  {
    scanId: {
      type: String,
      required: false,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    feedback: {
      type: String,
      required: false,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

export const Rating = mongoose.model<IRating>('Rating', RatingSchema);
