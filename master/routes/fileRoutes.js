import { Router } from 'express';
import multer from 'multer';
import {
  uploadFile,
  getUserFiles,
  deleteUserFile,
  downloadUserFile,
  getFileChunkInfo,
} from '../controllers/fileController.js';
import { apiKeyMiddleware } from '../middlewares/apiKeyMiddleware.js';
import { authRateLimiter } from '../middlewares/rateLimitMiddleware.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/upload', authRateLimiter, apiKeyMiddleware, upload.single('file'), uploadFile);
router.get('/user-files', authRateLimiter, apiKeyMiddleware, getUserFiles);
router.get('/chunk-info', authRateLimiter, apiKeyMiddleware, getFileChunkInfo);
router.get('/download', authRateLimiter, apiKeyMiddleware, downloadUserFile);
router.delete('/delete', authRateLimiter, apiKeyMiddleware, deleteUserFile);

export default router;
