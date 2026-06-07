import { Response } from 'express';
import Photo from '../models/Photo';

export const searchPhotos = async (req: any, res: Response) => {
  try {
    const { query } = req.query;
    if (!query) {
      return res.status(400).json({ message: 'Query string is required' });
    }

    // Full text search on tags and ocrText (indexed in Photo model)
    const photos = await Photo.find({
      userId: req.user._id,
      deleted: false,
      $text: { $search: query as string }
    }).sort({ score: { $meta: 'textScore' } });

    res.json(photos);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
