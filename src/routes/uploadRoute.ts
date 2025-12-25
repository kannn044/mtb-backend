import { Router } from 'express';
import { uploadFile, uploadMiddleware } from '../controllers/uploadController'; // import มาจากไฟล์ข้างบน
import { checkAuth } from '../middlewares/auth';
import multer from 'multer';
import path from 'path';

const router = Router();

router.post('/', checkAuth, uploadMiddleware.single('file'), uploadFile);

export default router;