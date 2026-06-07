import Photo from '../models/Photo';
import User from '../models/User';
import { deleteFromTelegram } from '../services/telegramService';

let cleanupInterval: NodeJS.Timeout | null = null;

export const startTrashCleanupJob = () => {
  if (cleanupInterval) return;

  console.log('🗑️ Starting Trash Cleanup Job (runs every 1 hour)...');

  // Run every 1 hour
  cleanupInterval = setInterval(async () => {
    try {
      // Find photos where deleted is true and deletedAt is older than 30 days ago
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const expiredPhotos = await Photo.find({
        deleted: true,
        deletedAt: { $lt: thirtyDaysAgo }
      });

      for (const photo of expiredPhotos) {
        console.log(`[Trash Cleanup] Permanently deleting photo: ${photo._id}`);

        // 1. Delete from Telegram
        await deleteFromTelegram(photo.telegramMessageId);

        // 2. Reduce user storage
        await User.findByIdAndUpdate(photo.userId, { $inc: { storageUsed: -photo.fileSize } });

        // 3. Delete from MongoDB
        await Photo.deleteOne({ _id: photo._id });
      }

      if (expiredPhotos.length > 0) {
        console.log(`[Trash Cleanup] Successfully purged ${expiredPhotos.length} photos.`);
      }
    } catch (error) {
      console.error('[Trash Cleanup] Error during cleanup job:', error);
    }
  }, 60 * 60 * 1000); // 1 hour
};

export const stopTrashCleanupJob = () => {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
    console.log('🗑️ Stopped Trash Cleanup Job');
  }
};
