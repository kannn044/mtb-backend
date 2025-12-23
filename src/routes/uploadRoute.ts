import { Router } from 'express';
import { uploadFile } from '../controllers/uploadController'
import { checkAuth } from '../middlewares/auth';

const router = Router();

// POST /api/upload
router.post('/', checkAuth, uploadFile);

export default router;