import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { knex } from 'knex';

// ---------------------------------------------------------
// 1. SETUP DATABASE (ถ้าคุณมีไฟล์ db config แยก ให้นำเข้าแทนส่วนนี้)
// ---------------------------------------------------------
const db = knex({
  client: 'mysql2',
  connection: {
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'mtb_database',
  },
});

// ---------------------------------------------------------
// 2. SETUP MULTER (จัดการการอัปโหลดไฟล์)
// ---------------------------------------------------------
const uploadDir = 'uploads/';

// ตรวจสอบว่ามีโฟลเดอร์ uploads ไหม ถ้าไม่มีให้สร้าง
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // ตั้งชื่อไฟล์ใหม่: timestamp-random-ชื่อเดิม (เพื่อไม่ให้ชื่อซ้ำ)
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    // ป้องกันชื่อไฟล์ภาษาไทยเพี้ยน (อาจใช้แค่ uniqueSuffix + ext ก็ได้)
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  }
});

// Export ตัว middleware นี้ไปใช้ที่ route (เช่น router.post('/upload', uploadMiddleware.single('file'), ...))
export const uploadMiddleware = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 } // จำกัดขนาด 10MB (ปรับได้)
});

// ---------------------------------------------------------
// 3. CONTROLLER (Logic การทำงาน)
// ---------------------------------------------------------
export const uploadFile = async (req: Request, res: Response): Promise<void> => {
  try {
    // ข้อมูล Meta Data จาก Body
    const { title, description } = req.body;
    
    // ข้อมูลไฟล์จาก Multer
    const file = req.file;

    // Validation: ตรวจสอบว่ามีไฟล์หรือไม่
    if (!file) {
      res.status(StatusCodes.BAD_REQUEST).json({ message: 'No file uploaded' });
      return;
    }

    // Validation: ตรวจสอบ Title
    if (!title) {
        // ถ้าไม่มี Title ให้ลบไฟล์ที่อัปโหลดเข้ามาทิ้งเพื่อไม่ให้รก Server
        fs.unlinkSync(file.path);
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'Title is required' });
        return;
    }

    console.log('--- Uploading ---');
    console.log('Title:', title);
    console.log('File:', file.filename);

    // const insertData = {
    //   title: title,
    //   description: description || '',
    //   original_name: file.originalname,
    //   filename: file.filename,
    //   file_path: file.path,
    //   mime_type: file.mimetype,
    //   size: file.size,
    //   created_at: new Date()
    // };

    // await db('files').insert(insertData);

    // ตอบกลับ Frontend
    res.status(StatusCodes.CREATED).json({ 
      message: 'Upload success',
      // data: insertData
    });

  } catch (error) {
    console.error('Upload Error:', error);

    // ถ้า error และมีไฟล์ค้างอยู่ ให้ลบไฟล์ทิ้ง
    if (req.file && req.file.path) {
        try { fs.unlinkSync(req.file.path); } catch(e) {}
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: errorMessage });
  }
};