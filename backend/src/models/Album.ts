import mongoose, { Document, Schema } from 'mongoose';
import crypto from 'crypto';

export interface IAlbum extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  coverPhoto?: mongoose.Types.ObjectId;
  shareToken?: string;
  isPublic: boolean;
  createdAt: Date;
}

const AlbumSchema: Schema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  description: { type: String },
  coverPhoto: { type: Schema.Types.ObjectId, ref: 'Photo' },
  shareToken: { type: String, unique: true, sparse: true },
  isPublic: { type: Boolean, default: false },
}, { timestamps: true });

export default mongoose.model<IAlbum>('Album', AlbumSchema);
