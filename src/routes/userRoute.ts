import { Router } from 'express';
import { getUsers, registerUser } from '../controllers/userController';
import { checkAuth } from '../middlewares/auth';

const router = Router();

// GET /api/users
router.get('/', checkAuth, getUsers);

// POST /api/users/register
router.post('/register', checkAuth, registerUser);

export default router;