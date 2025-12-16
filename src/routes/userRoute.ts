import { Router } from 'express';
import { getUsers } from '../controllers/userController';

const router = Router();

// GET /api/users
router.get('/', getUsers);

export default router;