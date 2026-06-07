import express from 'express';
import multer from 'multer';
import { protect } from '../middlewares/authMiddleware';
import { uploadPhoto, getPhotos, getPhotoUrl, getTrashPhotos, permanentDeletePhoto, getLocations } from '../controllers/photoController';
import { toggleFavorite, moveToTrash, restorePhoto } from '../controllers/photoGalleryController';
import { searchPhotos } from '../controllers/photoSearchController';

const router = express.Router();

// Configure multer to use memory storage so we can stream it directly to Telegram
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit per file
});

router.route('/')
  .post(protect, upload.single('photo'), uploadPhoto)
  .get(protect, getPhotos);

router.get('/search', protect, searchPhotos);
router.get('/trash', protect, getTrashPhotos);
router.get('/locations', protect, getLocations);

router.get('/:id/url', protect, getPhotoUrl);
router.put('/:id/favorite', protect, toggleFavorite);
router.put('/:id/trash', protect, moveToTrash);
router.put('/:id/restore', protect, restorePhoto);
router.delete('/:id/permanent', protect, permanentDeletePhoto);

export default router;
