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

// Helper: check accepted sequence file extensions
const FASTA_EXTENSIONS = ['.fasta', '.fa', '.fas', '.fasta.gz', '.fa.gz'];

const isAcceptedSequenceFile = (filename: string): boolean => {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.fastq.gz')) return true;
  for (const ext of FASTA_EXTENSIONS) {
    if (lower.endsWith(ext)) return true;
  }
  return false;
};

// Filter A: สำหรับ Single Upload (รับ .fastq.gz และ FASTA files)
const sequenceFileFilter = (req: any, file: Express.Multer.File, cb: any) => {
  if (isAcceptedSequenceFile(file.originalname)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only .fastq.gz and FASTA files (.fasta, .fa, .fas, .fasta.gz, .fa.gz) are allowed!'), false);
  }
};

// Filter B: สำหรับ Batch Upload (ฉลาดขึ้น เช็คตาม Field Name)
const batchFilter = (req: any, file: Express.Multer.File, cb: any) => {
  // 1. ถ้าเป็นช่อง 'excel' ต้องเป็น .xlsx, .xls, หรือ .csv
  if (file.fieldname === 'excel') {
    if (file.originalname.match(/\.(xlsx|xls|csv)$/i)) { // i = case insensitive
      return cb(null, true);
    }
    return cb(new Error('Invalid metadata file. Only .xlsx, .xls, or .csv allowed!'), false);
  }
  
  // 2. ถ้าเป็นช่อง 'files' ต้องเป็น .fastq.gz หรือ FASTA files
  if (file.fieldname === 'files') {
    if (isAcceptedSequenceFile(file.originalname)) {
      return cb(null, true);
    }
    return cb(new Error('Invalid sequencing file. Only .fastq.gz and FASTA files (.fasta, .fa, .fas, .fasta.gz, .fa.gz) are allowed!'), false);
  }

  // 3. ถ้าเป็นช่องอื่นที่ไม่รู้จัก
  cb(new Error('Unexpected field name'), false);
};


// --- 3. EXPORT MIDDLEWARES แยกกัน ---

// ตัวเดิม (ใช้กับ route /single) — now accepts .fastq.gz + FASTA
export const uploadGzMiddleware = multer({ 
    storage: storage,
    fileFilter: sequenceFileFilter,
    limits: { fileSize: 700 * 1024 * 1024 } // 700MB
});

// ตัวใหม่ (ใช้กับ route /batch)
export const uploadBatchMiddleware = multer({ 
    storage: storage,
    fileFilter: batchFilter,
    limits: { fileSize: 700 * 1024 * 1024 } // 700MB
});