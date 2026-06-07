import express from 'express';
import { protect } from '../middlewares/authMiddleware';
import {
  createAlbum,
  getAlbums,
  getAlbumPhotos,
  addPhotoToAlbum,
  generateShareLink,
  revokeShareLink,
  getPublicAlbum,
  shareAlbum,
  inviteUser,
  updateCollaboratorRole,
} from '../controllers/albumController';

const router = express.Router();

// Public — no auth needed
router.get('/public/:token', getPublicAlbum);

// Protected
router.route('/')
  .post(protect, createAlbum)
  .get(protect, getAlbums);

router.get('/:id/photos', protect, getAlbumPhotos);
router.post('/:id/photos', protect, addPhotoToAlbum);
router.post('/:id/share', protect, shareAlbum);
router.post('/:id/invite', protect, inviteUser);
router.put('/:id/collaborator', protect, updateCollaboratorRole);
router.post('/:id/share-link', protect, generateShareLink);
router.delete('/:id/share-link', protect, revokeShareLink);

export default router;
