import { Router, Request, Response, NextFunction } from 'express';
import { uploadFileSingle, uploadFileBatch, getProvinces, getDistricts } from '../controllers/uploadController';
import { uploadGzMiddleware, uploadBatchMiddleware } from '../middlewares/upload'; // Import ตัวใหม่มา
import { checkAuth } from '../middlewares/auth';
import multer from 'multer';

const router = Router();

router.post('/single', checkAuth, uploadGzMiddleware.array('files'), uploadFileSingle);
router.post('/batch', checkAuth,uploadBatchMiddleware.fields([
    { name: 'excel', maxCount: 1 },
    { name: 'files', maxCount: 50 }
  ]), uploadFileBatch);
router.get('/provinces', checkAuth, getProvinces);
router.get('/districts', checkAuth, getDistricts);

export default router;