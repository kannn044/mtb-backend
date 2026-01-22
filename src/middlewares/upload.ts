import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { ensureDirSync, getUploadBaseDir } from '../utils/uploadPaths';

// --- 1. SETUP STORAGE (ใช้ร่วมกัน) ---
const uploadRoot = getUploadBaseDir();
const tempDir = path.join(uploadRoot, 'temp');

if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}
ensureDirSync(tempDir);


const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Ensure the directory exists for cold starts / serverless runtimes.
    try {
      ensureDirSync(tempDir);
    } catch (e) {
      return cb(e as Error, tempDir);
    }
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = file.originalname + '_' + Date.now();
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

// --- 2. FILE FILTERS แยกกัน ---

// Filter A: สำหรับ Single Upload (รับแค่ .gz อย่างเดียว)
const gzOnlyFilter = (req: any, file: Express.Multer.File, cb: any) => {
  if (file.originalname.toLowerCase().endsWith('.gz')) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only .gz files are allowed!'), false);
  }
};

// Filter B: สำหรับ Batch Upload (ฉลาดขึ้น เช็คตาม Field Name)
const batchFilter = (req: any, file: Express.Multer.File, cb: any) => {
  // 1. ถ้าเป็นช่อง 'excel' ต้องเป็น .xlsx หรือ .xls
  if (file.fieldname === 'excel') {
    if (file.originalname.match(/\.(xlsx|xls)$/i)) { // i = case insensitive
      return cb(null, true);
    }
    return cb(new Error('Invalid metadata file. Only .xlsx or .xls allowed!'), false);
  }
  
  // 2. ถ้าเป็นช่อง 'files' ต้องเป็น .gz
  if (file.fieldname === 'files') {
    if (file.originalname.toLowerCase().endsWith('.gz')) {
      return cb(null, true);
    }
    return cb(new Error('Invalid sequencing file. Only .gz allowed!'), false);
  }

  // 3. ถ้าเป็นช่องอื่นที่ไม่รู้จัก
  cb(new Error('Unexpected field name'), false);
};


// --- 3. EXPORT MIDDLEWARES แยกกัน ---

// ตัวเดิม (ใช้กับ route /single)
export const uploadGzMiddleware = multer({ 
    storage: storage,
    fileFilter: gzOnlyFilter,
    limits: { fileSize: 700 * 1024 * 1024 } // 700MB
});

// ตัวใหม่ (ใช้กับ route /batch)
export const uploadBatchMiddleware = multer({ 
    storage: storage,
    fileFilter: batchFilter,
    limits: { fileSize: 700 * 1024 * 1024 } // 700MB
});