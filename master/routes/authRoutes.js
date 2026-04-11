import { Router } from 'express';
import { login ,  signup } from '../controllers/authController.js';
// import { authMiddleware } from '../middlewares/authMiddleware.js';

const router = Router();

router.post('/signup', signup);
router.post('/login', login);
// router.get('/me', authMiddleware, me);

export default router;
 