import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import fs from 'fs';
import path from 'path';
import * as xlsx from 'xlsx';
import { Knex } from 'knex';

// =============================================================================
// 1. CONFIGURATION & TYPES (การตั้งค่าและ Type)
// =============================================================================

// กำหนด Path ต่างๆ
const UPLOAD_ROOT = 'uploads';
const SEQ_DATA_ROOT = path.join(UPLOAD_ROOT, 'seq_data');
const TEXT_FILE_PATH = path.join(UPLOAD_ROOT, 'metadata_records.txt');

// สร้างโฟลเดอร์ที่จำเป็นตอนเริ่มทำงานทันที (ถ้ายังไม่มี)
[UPLOAD_ROOT, SEQ_DATA_ROOT].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Header ที่ต้องมีใน Metadata (และไฟล์ Text)
const REQUIRED_HEADERS = [
  'patient_id', 'sample_id', 'collection_date', 'district', 
  'province', 'sex', 'age', 'ethnic_group', 'education', 
  'occupation', 'chest_x_ray', 'treatment_outcome'
];

// Interface เพื่อแก้ปัญหา TypeScript ไม่รู้จัก req.db
interface CustomRequest extends Request {
  db: Knex;
}

// =============================================================================
// 2. HELPER FUNCTIONS (ฟังก์ชันช่วยทำงาน)
// =============================================================================

// แก้ไขชื่อไฟล์ภาษาไทยที่เพี้ยนจาก Multer
const fixUtf8 = (originalName: string): string => {
  return Buffer.from(originalName, 'latin1').toString('utf8');
};

// ลบไฟล์ Temp ทิ้งเมื่อเกิด Error (Safety Cleanup)
const cleanupFiles = (files: Express.Multer.File[]) => {
  files.forEach(file => {
      if (fs.existsSync(file.path)) {
          try { fs.unlinkSync(file.path); } catch (e) { console.warn('Cleanup warning:', e); }
      }
  });
};

// อ่านไฟล์ Text เดิมและคืนค่าเป็น Set ของ "patient_id|sample_id" เพื่อเช็คซ้ำ
const getExistingRecords = (): Set<string> => {
    const existingRecords = new Set<string>();
    
    // ถ้าไม่มีไฟล์ ก็คืนค่า Set ว่างๆ กลับไป
    if (!fs.existsSync(TEXT_FILE_PATH)) return existingRecords;

    try {
        const fileContent = fs.readFileSync(TEXT_FILE_PATH, 'utf8');
        const lines = fileContent.split('\n');
        
        if (lines.length > 0) {
            // หา Index ของ column ID จากบรรทัดแรก
            const headers = lines[0].trim().split('\t');
            const pIndex = headers.indexOf('patient_id');
            const sIndex = headers.indexOf('sample_id');

            if (pIndex !== -1 && sIndex !== -1) {
                // วนลูปบรรทัดข้อมูล (ข้าม header i=0)
                for (let i = 1; i < lines.length; i++) {
                    const line = lines[i].trim();
                    if (!line) continue;
                    
                    const cols = line.split('\t');
                    const pId = cols[pIndex]?.trim();
                    const sId = cols[sIndex]?.trim();
                    
                    if (pId && sId) {
                        existingRecords.add(`${pId}|${sId}`);
                    }
                }
            }
        }
    } catch (error) {
        console.error("Error reading existing records:", error);
    }
    
    return existingRecords;
};

// แปลง Object ข้อมูลเป็น String คั่นด้วย Tab (TSV)
const formatRowToTsv = (row: any): string => {
    return REQUIRED_HEADERS.map(header => {
        const val = row[header];
        // แปลง null/undefined เป็น 'NA' ถ้ามีค่าให้ตัดช่องว่างซ้ายขวา
        return (val !== undefined && val !== null) ? String(val).trim() : 'NA';
    }).join('\t');
};

// ย้ายไฟล์ไปยังโฟลเดอร์ seq_data
const moveFileToSeqData = (file: Express.Multer.File) => {
    const targetPath = path.join(SEQ_DATA_ROOT, file.originalname);
    fs.renameSync(file.path, targetPath);
};

// =============================================================================
// 3. CONTROLLERS (ส่วนควบคุมหลัก)
// =============================================================================

// Upload แบบไฟล์เดียว (Single)
export const uploadFileSingle = async (req: Request, res: Response): Promise<void> => {
  let uploadedFiles: Express.Multer.File[] = [];

  try {
    // --- 1. เตรียมข้อมูล ---
    uploadedFiles = (req.files as Express.Multer.File[]) || [];
    
    // แก้ชื่อไฟล์
    uploadedFiles.forEach(f => f.originalname = fixUtf8(f.originalname));

    // รับ Metadata
    let metadataObj: any;
    try {
      metadataObj = JSON.parse(req.body.metadata);
    } catch (e) {
      cleanupFiles(uploadedFiles);
      res.status(StatusCodes.BAD_REQUEST).json({ message: 'Invalid metadata JSON format' });
      return;
    }

    // ตรวจสอบเบื้องต้น
    if (uploadedFiles.length === 0 || !metadataObj.patient_id || !metadataObj.sample_id) {
        cleanupFiles(uploadedFiles);
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'Missing files, patient_id, or sample_id' });
        return;
    }

    // --- 2. เช็คซ้ำ (Duplicate Check) ---
    const existingRecords = getExistingRecords();
    const newKey = `${String(metadataObj.patient_id).trim()}|${String(metadataObj.sample_id).trim()}`;
    const isDuplicate = existingRecords.has(newKey);

    // --- 3. บันทึก Metadata (เฉพาะถ้าไม่ซ้ำ) ---
    if (!isDuplicate) {
        const lineToWrite = formatRowToTsv(metadataObj);

        try {
            if (!fs.existsSync(TEXT_FILE_PATH)) {
                // ไฟล์ใหม่: เขียน Header + Data
                fs.writeFileSync(TEXT_FILE_PATH, REQUIRED_HEADERS.join('\t') + '\n' + lineToWrite + '\n', 'utf8');
            } else {
                // ไฟล์เดิม: ต่อท้าย
                fs.appendFileSync(TEXT_FILE_PATH, lineToWrite + '\n', 'utf8');
            }
            console.log(`[Single] Saved new metadata for ${newKey}`);
        } catch (err) {
            console.error("[Single] Failed to write text file", err);
        }
    } else {
        console.log(`[Single] Duplicate metadata found for ${newKey}. Skipping text save.`);
    }

    // --- 4. ย้ายไฟล์ (ทำเสมอ) ---
    uploadedFiles.forEach(file => moveFileToSeqData(file));

    // --- 5. ส่งผลลัพธ์ ---
    res.status(StatusCodes.CREATED).json({ 
      message: isDuplicate ? 'Files uploaded (Metadata skipped - Duplicate)' : 'Upload success',
      saved_to: SEQ_DATA_ROOT,
      isDuplicate: isDuplicate,
      filesProcessed: uploadedFiles.length
    });

  } catch (error) {
    console.error('Single Upload Error:', error);
    cleanupFiles(uploadedFiles);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    if (!res.headersSent) res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: msg });
  }
};

// Upload แบบกลุ่ม (Batch - Excel)
export const uploadFileBatch = async (req: Request, res: Response): Promise<void> => {
  let allUploadedFiles: Express.Multer.File[] = [];

  try {
    // --- 1. รับไฟล์ ---
    const filesMap = req.files as { [fieldname: string]: Express.Multer.File[] };
    const excelFile = filesMap['excel'] ? filesMap['excel'][0] : null;
    const gzFiles = filesMap['files'] || [];

    // แก้ชื่อไฟล์ & เก็บเข้า List รวมเพื่อรอ Cleanup
    if (excelFile) {
        excelFile.originalname = fixUtf8(excelFile.originalname);
        allUploadedFiles.push(excelFile);
    }
    gzFiles.forEach(f => f.originalname = fixUtf8(f.originalname));
    allUploadedFiles = [...allUploadedFiles, ...gzFiles];

    // ตรวจสอบ
    if (!excelFile || gzFiles.length === 0) {
        cleanupFiles(allUploadedFiles);
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'Missing Excel file or .gz files' });
        return;
    }

    // --- 2. อ่าน Excel ---
    const workbook = xlsx.readFile(excelFile.path);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // ตรวจ Header ของ Excel
    const sheetHeaders = (xlsx.utils.sheet_to_json(sheet, { header: 1 })[0] as string[]) || [];
    const missingHeaders = REQUIRED_HEADERS.filter(h => !sheetHeaders.includes(h));
    
    if (missingHeaders.length > 0) {
        cleanupFiles(allUploadedFiles);
        res.status(StatusCodes.BAD_REQUEST).json({ message: `Excel missing columns: ${missingHeaders.join(', ')}` });
        return;
    }

    const excelData: any[] = xlsx.utils.sheet_to_json(sheet);
    if (excelData.length === 0) {
        cleanupFiles(allUploadedFiles);
        res.status(StatusCodes.BAD_REQUEST).json({ message: "Excel file is empty" });
        return;
    }

    // --- 3. จับคู่ไฟล์ (Matching Logic) ---
    const matchedData: any[] = [];
    const missingFiles: any[] = [];

    excelData.forEach((row) => {
        const sampleId = String(row.sample_id || '').trim();
        if (!sampleId) return; 

        // หาไฟล์ที่มีชื่อตรงกับ sample_id
        const foundFiles = gzFiles.filter(file => file.originalname.includes(sampleId));

        if (foundFiles.length > 0) {
            matchedData.push({ metadata: row, files: foundFiles });
        } else {
            missingFiles.push({ sample_id: sampleId, row_data: row });
        }
    });

    if (matchedData.length === 0) {
        cleanupFiles(allUploadedFiles);
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'No matching files found for the provided Excel data.' });
        return;
    }

    // --- 4. กรองตัวซ้ำ & บันทึก Metadata ---
    const existingRecords = getExistingRecords();
    const newRecordsToWrite: any[] = [];
    const skippedDuplicates: any[] = [];
    const allFilesToMove: Express.Multer.File[] = [];

    matchedData.forEach(item => {
        const pId = String(item.metadata.patient_id).trim();
        const sId = String(item.metadata.sample_id).trim();
        const key = `${pId}|${sId}`;

        // เก็บไฟล์เตรียมย้าย (ไม่สนว่าซ้ำหรือไม่ ย้ายหมด)
        item.files.forEach((f: Express.Multer.File) => allFilesToMove.push(f));

        if (existingRecords.has(key)) {
            skippedDuplicates.push(item);
        } else {
            newRecordsToWrite.push(item.metadata);
        }
    });

    // เขียนเฉพาะข้อมูลใหม่ลงไฟล์ Text
    if (newRecordsToWrite.length > 0) {
        const linesToWrite = newRecordsToWrite.map(row => formatRowToTsv(row)).join('\n');

        try {
            if (!fs.existsSync(TEXT_FILE_PATH)) {
                fs.writeFileSync(TEXT_FILE_PATH, REQUIRED_HEADERS.join('\t') + '\n' + linesToWrite + '\n', 'utf8');
            } else {
                fs.appendFileSync(TEXT_FILE_PATH, linesToWrite + '\n', 'utf8');
            }
            console.log(`[Batch] Saved ${newRecordsToWrite.length} new records.`);
        } catch (err) {
            console.error("[Batch] Failed to write text file", err);
        }
    }

    // --- 5. ย้ายไฟล์ (Move Files) ---
    let movedCount = 0;
    allFilesToMove.forEach(file => {
        moveFileToSeqData(file);
        movedCount++;
    });
    console.log(`[Batch] Moved ${movedCount} files to ${SEQ_DATA_ROOT}`);

    // --- 6. ส่งผลลัพธ์ ---
    cleanupFiles(allUploadedFiles); // ลบไฟล์ Excel ทิ้ง
    
    res.status(StatusCodes.OK).json({
        message: 'Batch upload processed',
        summary: {
            totalMatched: matchedData.length,
            newRecordsSaved: newRecordsToWrite.length,
            duplicatesSkipped: skippedDuplicates.length,
            filesMovedToSeqData: movedCount
        },
        missingFiles: missingFiles
    });

  } catch (error) {
    console.error('Batch Upload Error:', error);
    cleanupFiles(allUploadedFiles);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    if (!res.headersSent) res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: msg });
  }
};

// =============================================================================
// 4. DATABASE GETTERS (ดึงข้อมูล Location)
// =============================================================================

export const getProvinces = async (req: Request, res: Response): Promise<void> => {
    const customReq = req as CustomRequest;
    try {
        if (!customReq.db) throw new Error("Database connection missing");
        
        const provinces = await customReq.db('province').select('adm1_name', 'adm1_pcode');
        res.status(StatusCodes.OK).json(provinces);
    } catch (error) {
        console.error('Error fetching provinces:', error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal Server Error' });
    }
};

export const getDistricts = async (req: Request, res: Response): Promise<void> => {    
    const customReq = req as CustomRequest;
    try {
        if (!customReq.db) throw new Error("Database connection missing");

        const districts = await customReq.db('district')
            .select('adm2_name', 'adm2_pcode')
            .where('adm1_pcode', req.query.pcode as string);
        
        res.status(StatusCodes.OK).json(districts);
    } catch (error) {
        console.error('Error fetching districts:', error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal Server Error' });
    }
};