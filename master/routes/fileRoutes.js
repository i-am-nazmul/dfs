import { Router } from 'express';
import multer from 'multer';
import { uploadFile, getUserFiles } from '../controllers/fileController.js';
import { apiKeyMiddleware } from '../middlewares/apiKeyMiddleware.js';
import { authRateLimiter } from '../middlewares/rateLimitMiddleware.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/upload', authRateLimiter, apiKeyMiddleware, upload.single('file'), uploadFile);
router.get('/user-files', authRateLimiter, apiKeyMiddleware, getUserFiles);

export default router;
