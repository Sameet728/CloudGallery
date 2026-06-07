import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  username: string;
  email: string;
  password?: string;
  avatar?: string;
  storageUsed: number;
  createdAt: Date;
  lastLogin?: Date;
}

const UserSchema: Schema = new Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  avatar: { type: String, default: '' },
  storageUsed: { type: Number, default: 0 },
  lastLogin: { type: Date },
}, { timestamps: true });

export default mongoose.model<IUser>('User', UserSchema);
