import { Router } from 'express';
import { login ,  signup } from '../controllers/authController.js';
import { apiKeyMiddleware } from '../middlewares/apiKeyMiddleware.js';
import { authRateLimiter } from '../middlewares/rateLimitMiddleware.js';
// import { authMiddleware } from '../middlewares/authMiddleware.js';

const router = Router();

router.post('/signup', authRateLimiter, apiKeyMiddleware, signup);
router.post('/login', authRateLimiter, apiKeyMiddleware, login);
// router.get('/me', authMiddleware, me);

export default router;
 