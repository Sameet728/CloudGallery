import { Request, Response } from 'express';
import Photo from '../models/Photo';
import User from '../models/User';
import { uploadToTelegram, downloadFromTelegram, deleteFromTelegram, streamFromTelegram } from '../services/telegramService';
import { generateFileHash } from '../utils/hashUtils';
import { generateTags, extractOCR, extractExif, processFaces, generatePlaceholder } from '../services/aiService';
import sharp from 'sharp';

export const uploadPhoto = async (req: any, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const { originalname, buffer, size, mimetype } = req.file;

    // 1. Generate hash for duplicate detection
    const hash = generateFileHash(buffer);

    // 2. Check if this specific user already uploaded this photo
    const existingPhoto = await Photo.findOne({ userId: req.user._id, hash });
    if (existingPhoto) {
      return res.status(409).json({ message: 'This photo already exists', photo: existingPhoto });
    }

    // 2.5 Verify Image Integrity (Reject corrupt files immediately)
    const isVideo = mimetype.startsWith('video/');
    if (!isVideo) {
      try {
        await sharp(buffer).metadata();
      } catch (e) {
        return res.status(400).json({ message: 'Corrupted or invalid image file.' });
      }
    }

    const isVideo = mimetype.startsWith('video/');

    // 3. Process AI Metadata asynchronously (disabled to prevent Render Free Tier OOM)
    let tags: string[] = [], ocrText = '', blurhash = '', exif: any = null;
    
    if (!isVideo) {
      try {
        blurhash = await generatePlaceholder(buffer);
        exif = extractExif(buffer);
      } catch (e) {
        console.warn('Metadata extraction error:', e);
      }
    }

    // 4. Generate 3-tier resolutions & Upload to Telegram
    let thumbMessageId, mediumMessageId, originalMessageId, originalFileId;

    try {
      if (isVideo) {
        // Upload video directly
        const res = await uploadToTelegram(buffer, originalname);
        originalFileId = res.fileId;
        originalMessageId = res.messageId;
      } else {
        // 4a. Resize using Sharp
        const [thumbBuffer, mediumBuffer] = await Promise.all([
          sharp(buffer).resize(150, 150, { fit: 'cover' }).jpeg({ quality: 60 }).toBuffer(),
          sharp(buffer).resize(1080, null, { withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer()
        ]);

        // 4b. Upload all versions to Telegram using GramJS User API
        const [thumbRes, mediumRes, originalRes] = await Promise.all([
          uploadToTelegram(thumbBuffer, 'thumb_' + originalname),
          uploadToTelegram(mediumBuffer, 'medium_' + originalname),
          uploadToTelegram(buffer, originalname)
        ]);

        thumbMessageId = thumbRes.messageId;
        mediumMessageId = mediumRes.messageId;
        originalMessageId = originalRes.messageId;
        originalFileId = originalRes.fileId;
      }
    } catch (err) {
      console.warn('Upload failed, falling back to Single Tier. Error:', err);
      const res = await uploadToTelegram(buffer, originalname);
      originalFileId = res.fileId;
      originalMessageId = res.messageId;
    }

    const photo = await Photo.create({
      userId: req.user._id,
      telegramFileId: originalFileId,
      telegramMessageId: originalMessageId,
      thumbnailFileId: thumbMessageId ? thumbMessageId.toString() : undefined,
      mediumFileId: mediumMessageId ? mediumMessageId.toString() : undefined,
      originalFileId: originalMessageId ? originalMessageId.toString() : undefined,
      fileName: originalname,
      fileSize: size,
      mimeType: mimetype,
      hash,
      tags,
      ocrText,
      blurhash,
      width: exif?.width,
      height: exif?.height,
      location: exif?.location,
    });

    // 6. Process faces asynchronously (disabled to prevent Render Free Tier OOM)
    /*
    if (!isVideo) {
      const faceIds = await processFaces(buffer, photo._id.toString(), req.user._id.toString());
      if (faceIds.length > 0) {
        photo.faceIds = faceIds;
        await photo.save();
      }
    }
    */

    // 6. Update user storage used
    await User.findByIdAndUpdate(req.user._id, { $inc: { storageUsed: size } });

    res.status(201).json(photo);
  } catch (error: any) {
    console.error('Upload error:', error);
    res.status(500).json({ message: error.message || 'Failed to upload photo' });
  }
};

export const getPhotos = async (req: any, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const skip = (page - 1) * limit;

    const photos = await Photo.find({ userId: req.user._id, deleted: false })
      .populate('faceIds', 'name')
      .sort({ uploadDate: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Photo.countDocuments({ userId: req.user._id, deleted: false });

    // Note: We don't fetch the Telegram URL here directly because Telegram file URLs expire
    // The client will request the URL when it needs to display/download the image
    res.json({
      photos,
      page,
      pages: Math.ceil(total / limit),
      total
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getTrashPhotos = async (req: any, res: Response) => {
  try {
    const photos = await Photo.find({ userId: req.user._id, deleted: true })
      .sort({ deletedAt: -1 });

    res.json({ photos });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const permanentDeletePhoto = async (req: any, res: Response) => {
  try {
    const photo = await Photo.findOne({ _id: req.params.id, userId: req.user._id });
    if (!photo) return res.status(404).json({ message: 'Photo not found' });

    // 1. Delete from Telegram
    await deleteFromTelegram(photo.telegramMessageId);

    // 2. Reduce storage used
    await User.findByIdAndUpdate(photo.userId, { $inc: { storageUsed: -photo.fileSize } });

    // 3. Remove from DB
    await Photo.deleteOne({ _id: photo._id });

    res.json({ message: 'Photo permanently deleted' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getLocations = async (req: any, res: Response) => {
  try {
    const photos = await Photo.find({ 
      userId: req.user._id, 
      deleted: false,
      location: { $exists: true, $ne: null }
    }).select('_id location blurhash thumbnailFileId mimeType');
    
    res.json(photos);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getPhotoUrl = async (req: any, res: Response) => {
  try {
    const photo = await Photo.findOne({ _id: req.params.id, userId: req.user._id });
    
    if (!photo) {
      return res.status(404).json({ message: 'Photo not found' });
    }

    // Determine which resolution to serve
    const resolution = req.query.resolution as string;
    let targetMessageId = photo.telegramMessageId;

    if (resolution === 'thumbnail' && photo.thumbnailFileId) {
      targetMessageId = parseInt(photo.thumbnailFileId);
    } else if (resolution === 'medium' && photo.mediumFileId) {
      targetMessageId = parseInt(photo.mediumFileId);
    } else if (resolution === 'original' && photo.originalFileId) {
      targetMessageId = parseInt(photo.originalFileId);
    }

    const stream = streamFromTelegram(targetMessageId);
    
    res.set('Content-Type', photo.mimeType || 'image/jpeg');
    res.set('Content-Disposition', `inline; filename="${photo.fileName}"`);

    for await (const chunk of await stream) {
      res.write(chunk);
    }
    res.end();
  } catch (error: any) {
    if (!res.headersSent) {
      res.status(500).json({ message: error.message });
    }
  }
};
