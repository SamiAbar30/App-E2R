import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IAdditiveDictionary extends Document {
  eNumber: string;
  commonName: string;
  simplifiedName?: string;
  category: string;
  aliases: string[];
  isAllergen?: boolean;
  updatedAt: Date;
}

interface AdditiveDictionaryModel extends Model<IAdditiveDictionary> {
  findByAlias(alias: string): Promise<IAdditiveDictionary | null>;
}

function normalizeAlias(value: string): string {
  return String(value || '').toUpperCase().replace(/[\s-]/g, '');
}

const AdditiveDictionarySchema = new Schema<IAdditiveDictionary, AdditiveDictionaryModel>({
  eNumber: { type: String, required: true, index: true },
  commonName: { type: String, required: true },
  simplifiedName: { type: String },
  category: { type: String, required: true },
  aliases: [{ type: String, index: true }],
  isAllergen: { type: Boolean, default: false },
  updatedAt: { type: Date, default: Date.now }
}, {
  collection: 'additive_dictionaries'
});

AdditiveDictionarySchema.statics.findByAlias = function findByAlias(alias: string) {
  const normalizedAlias = normalizeAlias(alias);
  return this.findOne({
    $or: [
      { eNumber: normalizedAlias },
      { aliases: normalizedAlias }
    ]
  }).exec();
};

export const AdditiveDictionary =
  (mongoose.models.AdditiveDictionary as AdditiveDictionaryModel) ||
  mongoose.model<IAdditiveDictionary, AdditiveDictionaryModel>('AdditiveDictionary', AdditiveDictionarySchema);
