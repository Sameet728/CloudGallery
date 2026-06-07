import mongoose, { Document, Schema } from 'mongoose';

export interface IFace {
  photoId: mongoose.Types.ObjectId;
  descriptor: number[]; // 128D array
  box: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface IPerson extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  faces: IFace[];
  createdAt: Date;
}

const faceSchema = new Schema({
  photoId: { type: Schema.Types.ObjectId, ref: 'Photo', required: true },
  descriptor: { type: [Number], required: true },
  box: {
    x: Number,
    y: Number,
    width: Number,
    height: Number
  }
});

const personSchema = new Schema<IPerson>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, default: 'Unknown Person' },
  faces: [faceSchema],
  createdAt: { type: Date, default: Date.now },
});

// Index for faster queries
personSchema.index({ userId: 1 });

export default mongoose.model<IPerson>('Person', personSchema);
