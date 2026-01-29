import { Router } from 'express';
import { registerUser } from '../controllers/registerController';

const router = Router();

// POST /api/register/
router.post('/', registerUser);

export default router;
