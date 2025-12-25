import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import fs from 'fs';
import path from 'path';
import { Knex } from 'knex'; // Import Type เพื่อใช้ทำ Interface

const uploadRoot = 'uploads';

export const uploadFile = async (req: Request, res: Response): Promise<void> => {
  
  let uploadedFiles: Express.Multer.File[] = [];
  try {
    // 1. รับไฟล์จาก Middleware
    uploadedFiles = (req.files as Express.Multer.File[]) || [];
    
    // 2. รับ Metadata string และแปลงเป็น Object
    let metadataObj;
    try {
      metadataObj = JSON.parse(req.body.metadata);
    } catch (e) {
      res.status(StatusCodes.BAD_REQUEST).json({ message: 'Invalid metadata JSON format' });
      return; // จบการทำงาน
    }

    if (uploadedFiles.length === 0) {
      res.status(StatusCodes.BAD_REQUEST).json({ message: 'No .gz files uploaded' });
      return; // จบการทำงาน
    }
    
    // 4. เริ่ม Transaction (เมื่อไม่ซ้ำค่อยบันทึก)
    await req.db.transaction(async (trx) => {
      
      // A. Insert JSON ลง DB Table 'patient_metadata'
      const [metadataId] = await trx('patient_metadata').insert({
        data: JSON.stringify(metadataObj), 
        created_at: new Date(),
      });

      // B. สร้าง Folder ตาม ID
      const targetDir = path.join(uploadRoot, String(metadataId));
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      // C. ย้ายไฟล์จาก Temp -> Target ID Folder
      const fileRecords = uploadedFiles.map((file) => {
        const oldPath = file.path;
        const newFilename = file.filename;
        const newPath = path.join(targetDir, newFilename);

        // ย้ายไฟล์ (Rename = Cut & Paste)
        // ไฟล์ใน Temp จะหายไปเองเมื่อคำสั่งนี้สำเร็จ ไม่ต้องสั่งลบ
        fs.renameSync(oldPath, newPath);

        return {
          metadata_id: metadataId,
          filename: newFilename,
          original_name: file.originalname,
          file_path: newPath,
          size: file.size,
          created_at: new Date()
        };
      });

      // D. Insert ข้อมูลไฟล์ลง Table 'files'
      await trx('files').insert(fileRecords);
    });

    // 5. ส่ง Response Success
    res.status(StatusCodes.CREATED).json({ 
      message: 'Upload success',
      filesProcessed: uploadedFiles.length
    });
  } catch (error) {
    console.error('Upload Error:', error);
    // Cleanup: ลบไฟล์ Temp ทิ้งถ้าเกิด Error ระหว่างทาง (เช่น DB ล่ม, สร้าง Folder ไม่ได้)
    uploadedFiles.forEach(f => {
        if (fs.existsSync(f.path)) {
            try { fs.unlinkSync(f.path); } catch(e) {}
        }
    });
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    // ป้องกันการส่ง Response ซ้ำ (กรณี Error เกิดหลังจากส่ง Response ไปแล้ว)
    if (!res.headersSent) {
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: errorMessage });
    }
  }
};

export const getProvinces = async (req: Request, res: Response): Promise<void> => {
    try {
        const provinces = await req.db('province').select('adm1_name', 'adm1_pcode');
        res.status(StatusCodes.OK).json(provinces);
    } catch (error) {
        console.error('Error fetching provinces:', error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal Server Error' });
    }
};

export const getDistricts = async (req: Request, res: Response): Promise<void> => {    
    try {
        const districts = await req.db('district')
            .select('adm2_name', 'adm2_pcode')
            .where('adm1_pcode', req.query.pcode as string); // Cast query param เป็น string
        
        res.status(StatusCodes.OK).json(districts);
    } catch (error) {
        console.error('Error fetching districts:', error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal Server Error' });
    }
};