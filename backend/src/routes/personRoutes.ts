import express from 'express';
import { getPeople, renamePerson, analyzeLocalPhoto } from '../controllers/personController';
import { protect } from '../middlewares/authMiddleware';
import multer from 'multer';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

router.use(protect);

router.get('/', getPeople);
router.post('/:id/rename', renamePerson);
router.post('/analyze-local', upload.single('photo'), analyzeLocalPhoto);

export default router;
