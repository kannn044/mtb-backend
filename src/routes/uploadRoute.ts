import { Router, Request, Response, NextFunction } from 'express';
import { uploadFile, getProvinces, getDistricts } from '../controllers/uploadController';
import { uploadMiddleware } from '../middlewares/upload';
import { checkAuth } from '../middlewares/auth';
import multer from 'multer';

const router = Router();

router.post('/', checkAuth, uploadMiddleware.array('files'), uploadFile);
router.get('/provinces', checkAuth, getProvinces);
router.get('/districts', checkAuth, getDistricts);

export default router;