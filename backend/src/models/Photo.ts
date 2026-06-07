import mongoose, { Document, Schema } from 'mongoose';

export interface IPhoto extends Document {
  userId: mongoose.Types.ObjectId;
  telegramFileId: string;
  telegramMessageId: number;
  albumId?: mongoose.Types.ObjectId;
  fileName: string;
  fileSize: number;
  mimeType: string;
  width?: number;
  height?: number;
  uploadDate: Date;
  tags: string[];
  favorite: boolean;
  deleted: boolean;
  deletedAt?: Date;
  hash: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  ocrText?: string;
  faceIds?: mongoose.Types.ObjectId[];
  blurhash?: string;
  thumbnailFileId?: string;
  mediumFileId?: string;
  originalFileId?: string;
}

const PhotoSchema: Schema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  telegramFileId: { type: String, required: true },
  telegramMessageId: { type: Number, required: true },
  albumId: { type: Schema.Types.ObjectId, ref: 'Album' },
  fileName: { type: String, required: true },
  fileSize: { type: Number, required: true },
  mimeType: { type: String, required: true },
  width: { type: Number },
  height: { type: Number },
  uploadDate: { type: Date, default: Date.now },
  tags: [{ type: String }],
  favorite: { type: Boolean, default: false },
  deleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
  hash: { type: String, required: true },
  location: {
    latitude: { type: Number },
    longitude: { type: Number }
  },
  ocrText: { type: String },
  blurhash: { type: String },
  thumbnailFileId: { type: String },
  mediumFileId: { type: String },
  originalFileId: { type: String },
  faceIds: [{ type: Schema.Types.ObjectId, ref: 'Person' }]
}, { timestamps: true });

// Indexes for fast searching
PhotoSchema.index({ userId: 1, uploadDate: -1 });
PhotoSchema.index({ userId: 1, hash: 1 });
PhotoSchema.index({ tags: 'text', ocrText: 'text' });

export default mongoose.model<IPhoto>('Photo', PhotoSchema);
