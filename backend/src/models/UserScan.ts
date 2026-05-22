import mongoose, { Schema, Document } from 'mongoose';

export interface IUserScan extends Document {
  userId: string;
  deviceOS: 'iOS' | 'Android';
  originalText: string;
  adaptedText: string;
  allergens: string[];
  graphicalElements: Array<{
    type: 'percentage' | 'quantity';
    ingredient: string;
    value: number;
    unit: string;
  }>;
  complexTermMappings: Array<{
    original: string;
    simplified: string;
    category: string;
  }>;
  processingMs: number;
  facileStatus: 'full' | 'partial' | 'failed';
  createdAt: Date;
}

const GraphicalElementSchema = new Schema({
  type: { type: String, enum: ['percentage', 'quantity'], required: true },
  ingredient: { type: String, required: true },
  value: { type: Number, required: true },
  unit: { type: String, required: true }
}, { _id: false });

const ComplexTermMappingSchema = new Schema({
  original: { type: String, required: true },
  simplified: { type: String, required: true },
  category: { type: String, required: true }
}, { _id: false });

const UserScanSchema = new Schema<IUserScan>({
  userId: { type: String, required: true, index: true },
  deviceOS: { type: String, enum: ['iOS', 'Android'], required: true },
  originalText: { type: String, required: true },
  adaptedText: { type: String, required: true },
  allergens: [{ type: String }],
  graphicalElements: [GraphicalElementSchema],
  complexTermMappings: [ComplexTermMappingSchema],
  processingMs: { type: Number, required: true },
  facileStatus: { type: String, enum: ['full', 'partial', 'failed'], default: 'full' }
}, {
  timestamps: true,
  collection: 'user_scans'
});

UserScanSchema.index({ userId: 1, createdAt: -1 });

export const UserScan = mongoose.model<IUserScan>('UserScan', UserScanSchema);
