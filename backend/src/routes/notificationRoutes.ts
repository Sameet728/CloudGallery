import express from 'express';
import { protect } from '../middlewares/authMiddleware';
import { getNotifications, markAsRead, markAllAsRead } from '../controllers/notificationController';

const router = express.Router();

router.use(protect);
router.get('/', getNotifications);
router.put('/read-all', markAllAsRead);
router.put('/:id/read', markAsRead);

export default router;
