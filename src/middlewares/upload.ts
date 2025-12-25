import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Setup Folder
const uploadRoot = 'uploads';
const tempDir = path.join(uploadRoot, 'temp');

// สร้าง Folder Temp ถ้ายังไม่มี
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Config Storage (พักไฟล์ที่ Temp)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

// Filter เช็ค .gz เท่านั้น
const fileFilter = (req: any, file: Express.Multer.File, cb: any) => {
  if (file.originalname.toLowerCase().endsWith('.gz')) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only .gz files are allowed!'), false);
  }
};

// Export Middleware
export const uploadMiddleware = multer({ 
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 700 * 1024 * 1024 } // 700MB Limit
});