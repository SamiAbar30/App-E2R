import mongoose, { Schema, Document } from 'mongoose';

export interface IApiLog extends Document {
  endpoint: string;
  method: string;
  userId?: string;
  statusCode: number;
  responseCode: string;
  latencyMs: number;
  errorMessage?: string;
  requestSize?: number;
  state?: string;
  timestamp: Date;
}

const ApiLogSchema = new Schema<IApiLog>({
  endpoint: { type: String, required: true },
  method: { type: String, required: true },
  userId: { type: String },
  statusCode: { type: Number, required: true },
  responseCode: { type: String, required: true },
  latencyMs: { type: Number, required: true },
  errorMessage: { type: String },
  requestSize: { type: Number },
  state: { type: String },
  timestamp: { type: Date, default: Date.now }
}, {
  collection: 'api_logs',
  capped: { size: 104857600, max: 100000 }
});

ApiLogSchema.index({ timestamp: -1 });
ApiLogSchema.index({ userId: 1, timestamp: -1 });

export const ApiLog = mongoose.model<IApiLog>('ApiLog', ApiLogSchema);
