import { Router } from 'express';
import { changePassword } from '../controllers/passwordController';
import { checkAuth } from '../middlewares/auth'; // Import the authentication middleware

const router = Router();

// POST /api/password/change-password (protected route)
router.post('/change-password', checkAuth, changePassword);

export default router;
