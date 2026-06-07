import { Response } from 'express';
import Photo from '../models/Photo';

export const toggleFavorite = async (req: any, res: Response) => {
  try {
    const photo = await Photo.findOne({ _id: req.params.id, userId: req.user._id });
    if (!photo) return res.status(404).json({ message: 'Photo not found' });

    photo.favorite = !photo.favorite;
    await photo.save();

    res.json(photo);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const moveToTrash = async (req: any, res: Response) => {
  try {
    const photo = await Photo.findOne({ _id: req.params.id, userId: req.user._id });
    if (!photo) return res.status(404).json({ message: 'Photo not found' });

    photo.deleted = true;
    photo.deletedAt = new Date();
    await photo.save();

    res.json({ message: 'Moved to trash' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const restorePhoto = async (req: any, res: Response) => {
  try {
    const photo = await Photo.findOne({ _id: req.params.id, userId: req.user._id, deleted: true });
    if (!photo) return res.status(404).json({ message: 'Photo not found in trash' });

    photo.deleted = false;
    photo.deletedAt = undefined;
    await photo.save();

    res.json({ message: 'Restored from trash', photo });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
