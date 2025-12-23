import { Router } from 'express';
import { uploadFile } from '../controllers/uploadController'
import { checkAuth } from '../middlewares/auth';
import multer from 'multer';
import path from 'path';

const router = Router();

router.post("/", checkAuth, async (req, res, next) => {
  try {
    console.log("test");
    return res.status(201).json({ ok: true, message: "uploaded" });
  } catch (err) {
    return next(err);
  }
});
// const storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     cb(null, 'public/');
//   },
//   filename: (req, file, cb) => {
//     const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
//     cb(null, uniqueSuffix + path.extname(file.originalname));
//   }
// });

// const upload = multer({ storage: storage });

// POST /api/upload
// router.post('/', checkAuth, upload.single('file'), async (req, res, next) => {
//   console.log('test');

// try {
//   const rs = await uploadFile(req, res);
//   console.log(rs);

//   if (!res.headersSent) {
//     return res.sendStatus(200);
//   }
// } catch (err) {
//   if (!res.headersSent) {
//     return res.sendStatus(500);
//   }
//   return next(err);
// }
// });

export default router;