import mongoose, { Document, Schema } from 'mongoose';

export interface ISharedAlbum extends Document {
  albumId: mongoose.Types.ObjectId;
  ownerId: mongoose.Types.ObjectId;
  members: {
    userId: mongoose.Types.ObjectId;
    permissions: 'Viewer' | 'Contributor' | 'Admin';
  }[];
}

const SharedAlbumSchema: Schema = new Schema({
  albumId: { type: Schema.Types.ObjectId, ref: 'Album', required: true },
  ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  members: [{
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    permissions: { type: String, enum: ['Viewer', 'Contributor', 'Admin'], default: 'Viewer' }
  }]
}, { timestamps: true });

export default mongoose.model<ISharedAlbum>('SharedAlbum', SharedAlbumSchema);
