import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import fs from 'fs';
import path from 'path';
import * as xlsx from 'xlsx';
import { Knex } from 'knex';
import jwt from 'jsonwebtoken';
import dotenv from "dotenv";
dotenv.config();
import { ensureDirSync, getUploadBaseDir } from '../utils/uploadPaths';

// =============================================================================
// 1. CONFIGURATION & TYPES
// =============================================================================

const UPLOAD_ROOT = `uploads`; 
const REQUIRED_HEADERS = [
  'patient_id', 'sample_id', 'fastq_1', 'fastq_2', 'collection_date', 'district', 
  'province', 'sex', 'age', 'ethnic_group', 'education', 
  'occupation', 'chest_x_ray', 'treatment_outcome'
];

interface CustomRequest extends Request {
  db: Knex;
}

// =============================================================================
// 2. HELPER FUNCTIONS
// =============================================================================

// Helper สำหรับดึง userId ตาม Logic ที่คุณให้มา
const getUserIdFromRequest = (req: Request): string => {
    const authHeader = req.headers.authorization;
    if (!authHeader) throw new Error('Missing authorization header');

    const token = authHeader.split(' ')[1];
    if (!token) throw new Error('Missing authorization token');

    try {
        const secret = process.env.JWT_SECRET || 'your_secret_key';
        const decoded = jwt.verify(token, secret) as any;
        
        // ตรวจสอบว่ามี id หรือไม่
        if (!decoded || !decoded.id) {
            throw new Error('Token payload missing "id" field');
        }

        return String(decoded.id); // แปลงเป็น string เสมอ (เช่น "1")
    } catch (e) {
        console.error("Token verification failed:", e);
        throw new Error('Invalid or expired token');
    }
};

const safeMove = (src: string, dest: string) => {
    try {
        fs.renameSync(src, dest);
    } catch (error: any) {
        if (error.code === 'EXDEV') {
            fs.cpSync(src, dest, { recursive: true });
            fs.rmSync(src, { recursive: true, force: true });
        } else {
            throw error;
        }
    }
};

const sanitizeFileName = (originalName: string): string => {
  const utf8Name = Buffer.from(originalName, 'latin1').toString('utf8');
  return path.basename(utf8Name);
};

const cleanupTempFiles = (files: Express.Multer.File[]) => {
  files.forEach(file => {
      if (fs.existsSync(file.path)) {
          try { fs.unlinkSync(file.path); } catch (e) { console.warn('Temp cleanup warning:', e); }
      }
  });
};

const rollbackDestinationFiles = (filePaths: string[]) => {
    filePaths.forEach(filePath => {
        if (fs.existsSync(filePath)) {
            try { fs.unlinkSync(filePath); console.log(`Rolled back: ${filePath}`); } 
            catch (e) { console.error(`Failed to rollback: ${filePath}`, e); }
        }
    });
};

// ใช้ userId สร้าง Path (user_spaces/user_[id])
const ensureUserDirs = (userId: string) => {
    const userDir = path.join(UPLOAD_ROOT, 'user_spaces', `user_${userId}`);
    const inputsDir = path.join(userDir, 'inputs');
    const seqDataDir = path.join(inputsDir, 'seq_data');
    const metadataDir = path.join(inputsDir, 'metadata');

    [userDir, inputsDir, seqDataDir, metadataDir].forEach(dir => {
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    });

    return { seqDataDir, metadataDir };
};

const getExistingRecords = (metadataPath: string): { sampleIds: Set<string> } => {
    const sampleIds = new Set<string>();
    if (fs.existsSync(metadataPath)) {
        try {
            const content = fs.readFileSync(metadataPath, 'utf8');
            const lines = content.split('\n');
            if (lines.length > 0) {
                // Header check (Tab separated)
                const headers = lines[0].trim().split('\t');
                const sIndex = headers.indexOf('sample_id');
                if (sIndex !== -1) {
                    for (let i = 1; i < lines.length; i++) {
                        const line = lines[i].trim();
                        if (!line) continue;
                        const cols = line.split('\t');
                        const sId = cols[sIndex]?.trim();
                        if (sId) sampleIds.add(sId);
                    }
                }
            }
        } catch (e) { console.error("Error reading metadata:", e); }
    }
    return { sampleIds };
};

const formatRowToTsv = (row: any): string => {
    return REQUIRED_HEADERS.map(header => {
        const val = row[header];
        return (val !== undefined && val !== null) ? String(val).trim() : 'NA';
    }).join('\t');
};

const getTimestamp = () => {
    const now = new Date();
    return now.toISOString().replace(/[-T:]/g, '').split('.')[0];
};

// =============================================================================
// 3. CONTROLLERS
// =============================================================================

export const uploadFileSingle = async (req: Request, res: Response): Promise<void> => {
    let uploadedFiles: Express.Multer.File[] = [];
    const movedFilePaths: string[] = [];

    try {
        console.log('[UploadSingle] incoming', {
            url: req.originalUrl,
            ip: req.ip,
            contentType: req.headers['content-type'],
            bodyKeys: Object.keys((req as any).body || {}),
            filesCount: Array.isArray((req as any).files) ? (req as any).files.length : 0,
        });

        // [UPDATE] เรียกใช้ Helper
        const userId = getUserIdFromRequest(req); 
        console.log('[UploadSingle] user', { userId });
        const { seqDataDir, metadataDir } = ensureUserDirs(userId);
        const metadataFilePath = path.join(metadataDir, 'metadata.txt');

        uploadedFiles = (req.files as Express.Multer.File[]) || [];
        uploadedFiles.forEach(f => f.originalname = sanitizeFileName(f.originalname));

        let metadataObj: any;
        try { metadataObj = JSON.parse(req.body.metadata); } 
        catch (e) { throw new Error('Invalid metadata JSON format'); }

        // Validation
        if (!metadataObj.sample_id || uploadedFiles.length !== 2) {
             throw new Error('Missing sample_id or must upload exactly 2 files for Single mode.');
        }

        const f1Name = metadataObj.fastq_1;
        const f2Name = metadataObj.fastq_2;
        const file1 = uploadedFiles.find(f => f.originalname === f1Name);
        const file2 = uploadedFiles.find(f => f.originalname === f2Name);

        if (!file1 || !file2) throw new Error(`Uploaded files do not match metadata filenames`);

        const { sampleIds } = getExistingRecords(metadataFilePath);
        
        if (sampleIds.has(String(metadataObj.sample_id))) throw new Error(`Duplicate sample_id detected`);
        if (fs.existsSync(path.join(seqDataDir, f1Name))) throw new Error(`File exists: ${f1Name}`);
        if (fs.existsSync(path.join(seqDataDir, f2Name))) throw new Error(`File exists: ${f2Name}`);

        // Move Files
        try {
            const dest1 = path.join(seqDataDir, f1Name);
            const dest2 = path.join(seqDataDir, f2Name);
            fs.renameSync(file1.path, dest1); movedFilePaths.push(dest1);
            fs.renameSync(file2.path, dest2); movedFilePaths.push(dest2);
        } catch (ioError) { throw new Error('Failed to move files.'); }

        // Write Metadata
        try {
            const lineToWrite = formatRowToTsv(metadataObj);
            if (!fs.existsSync(metadataFilePath)) {
                fs.writeFileSync(metadataFilePath, REQUIRED_HEADERS.join('\t') + '\n' + lineToWrite + '\n', 'utf8');
            } else {
                const content = fs.readFileSync(metadataFilePath, 'utf8');
                const prefix = (content.length > 0 && !content.endsWith('\n')) ? '\n' : '';
                fs.appendFileSync(metadataFilePath, prefix + lineToWrite + '\n', 'utf8');
            }
        } catch (writeError) { throw new Error('Failed to write metadata.'); }

        res.status(StatusCodes.CREATED).json({ message: 'Upload success', path: `user_${userId}` });

    } catch (error) {
        console.error('Single Upload Error:', {
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            url: req.originalUrl,
        });
        cleanupTempFiles(uploadedFiles);
        rollbackDestinationFiles(movedFilePaths);
        const msg = error instanceof Error ? error.message : 'Unknown error';
        if (!res.headersSent) res.status(StatusCodes.BAD_REQUEST).json({ message: msg });
    }
};

export const uploadFileBatch = async (req: Request, res: Response): Promise<void> => {
    let allUploadedFiles: Express.Multer.File[] = [];
    const movedFilePaths: string[] = [];

    try {
        const filesMapPreview = (req as any).files as { [fieldname: string]: Express.Multer.File[] } | undefined;
        console.log('[UploadBatch] incoming', {
            url: req.originalUrl,
            ip: req.ip,
            contentType: req.headers['content-type'],
            bodyKeys: Object.keys((req as any).body || {}),
            excelCount: filesMapPreview?.excel?.length ?? 0,
            gzCount: filesMapPreview?.files?.length ?? 0,
        });

        const userId = getUserIdFromRequest(req);
        console.log('[UploadBatch] user', { userId });
        const { seqDataDir, metadataDir } = ensureUserDirs(userId);
        const metadataFilePath = path.join(metadataDir, 'metadata.txt');

        const filesMap = req.files as { [fieldname: string]: Express.Multer.File[] };
        const excelFile = filesMap['excel'] ? filesMap['excel'][0] : null;
        const gzFiles = filesMap['files'] || [];

        if (excelFile) { excelFile.originalname = sanitizeFileName(excelFile.originalname); allUploadedFiles.push(excelFile); }
        gzFiles.forEach(f => { f.originalname = sanitizeFileName(f.originalname); allUploadedFiles.push(f); });

        if (!excelFile || gzFiles.length === 0) throw new Error('Missing Excel or .gz files');

        const workbook = xlsx.readFile(excelFile.path);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const excelData: any[] = xlsx.utils.sheet_to_json(sheet);

        if (excelData.length === 0) throw new Error("Excel file is empty");

        const { sampleIds } = getExistingRecords(metadataFilePath);
        const batchSampleIds = new Set<string>();
        const filesToMove: Array<{ file: Express.Multer.File, dest: string }> = [];

        for (let i = 0; i < excelData.length; i++) {
            const row = excelData[i];
            const sId = String(row.sample_id || '').trim();
            const f1Name = String(row.fastq_1 || '').trim();
            const f2Name = String(row.fastq_2 || '').trim();

            if (!sId || !f1Name || !f2Name) throw new Error(`Row ${i+1}: Missing info`);
            
            const file1 = gzFiles.find(f => f.originalname === f1Name);
            const file2 = gzFiles.find(f => f.originalname === f2Name);
            if (!file1 || !file2) throw new Error(`Row ${i+1}: Files not uploaded.`);

            if (sampleIds.has(sId)) throw new Error(`Row ${i+1}: Duplicate sample_id '${sId}' exists.`);
            if (fs.existsSync(path.join(seqDataDir, f1Name))) throw new Error(`File ${f1Name} exists.`);
            if (fs.existsSync(path.join(seqDataDir, f2Name))) throw new Error(`File ${f2Name} exists.`);
            if (batchSampleIds.has(sId)) throw new Error(`Row ${i+1}: Duplicate in batch.`);
            
            batchSampleIds.add(sId);
            filesToMove.push({ file: file1, dest: path.join(seqDataDir, f1Name) });
            filesToMove.push({ file: file2, dest: path.join(seqDataDir, f2Name) });
        }

        try {
            const uniqueMoves = new Map<string, {file: Express.Multer.File, dest: string}>();
            filesToMove.forEach(item => uniqueMoves.set(item.file.originalname, item));
            for (const item of uniqueMoves.values()) {
                safeMove(item.file.path, item.dest);
                movedFilePaths.push(item.dest);
            }
        } catch (ioError) { throw new Error('Failed to move batch files.'); }

        try {
            const linesToWrite = excelData.map(row => formatRowToTsv(row)).join('\n');
            if (!fs.existsSync(metadataFilePath)) {
                fs.writeFileSync(metadataFilePath, REQUIRED_HEADERS.join('\t') + '\n' + linesToWrite + '\n', 'utf8');
            } else {
                const content = fs.readFileSync(metadataFilePath, 'utf8');
                const prefix = (content.length > 0 && !content.endsWith('\n')) ? '\n' : '';
                fs.appendFileSync(metadataFilePath, prefix + linesToWrite + '\n', 'utf8');
            }
        } catch (writeError) { throw new Error('Failed to write batch metadata.'); }

        cleanupTempFiles(allUploadedFiles);
        res.status(StatusCodes.OK).json({ message: 'Batch upload success', records: excelData.length });

    } catch (error) {
        console.error('Batch Upload Error:', {
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            url: req.originalUrl,
        });
        cleanupTempFiles(allUploadedFiles);
        rollbackDestinationFiles(movedFilePaths);
        const msg = error instanceof Error ? error.message : 'Unknown error';
        if (!res.headersSent) res.status(StatusCodes.BAD_REQUEST).json({ message: msg });
    }
};

// =============================================================================
// GET RUN PREVIEW
// =============================================================================
export const getRunPreview = async (req: Request, res: Response): Promise<void> => {
    try {
        // [UPDATE] ใช้ getUserIdFromRequest แทน
        const userId = getUserIdFromRequest(req);
        
        const { metadataDir } = ensureUserDirs(userId);
        const metadataFilePath = path.join(metadataDir, 'metadata.txt');

        const samples: string[] = [];

        if (fs.existsSync(metadataFilePath)) {
            const content = fs.readFileSync(metadataFilePath, 'utf8');
            const lines = content.split('\n');
            if (lines.length > 0) {
                const headers = lines[0].trim().split('\t');
                const sIndex = headers.indexOf('sample_id');
                if (sIndex !== -1) {
                    for (let i = 1; i < lines.length; i++) {
                        const line = lines[i].trim();
                        if (!line) continue;
                        const cols = line.split('\t');
                        const sId = cols[sIndex]?.trim();
                        if (sId) samples.push(sId);
                    }
                } else {
                    console.warn(`[Preview] 'sample_id' header not found in ${metadataFilePath}`);
                }
            }
        } else {
            console.log(`[Preview] No metadata file found at ${metadataFilePath}`);
        }

        res.status(StatusCodes.OK).json({ samples });

    } catch (error) {
        console.error('Preview Error:', error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Failed to fetch preview' });
    }
};

// =============================================================================
// EXECUTE RUN PROCESS
// =============================================================================
export const executeRunProcess = async (req: Request, res: Response): Promise<void> => {
    try {
        // [UPDATE] ใช้ getUserIdFromRequest แทน
        const userId = getUserIdFromRequest(req);

        const { seqDataDir, metadataDir } = ensureUserDirs(userId);
        
        const hasMetadata = fs.existsSync(path.join(metadataDir, 'metadata.txt'));
        const hasSeqFiles = fs.readdirSync(seqDataDir).length > 0;

        if (!hasMetadata && !hasSeqFiles) {
            res.status(StatusCodes.BAD_REQUEST).json({ message: 'No data to run.' });
            return;
        }

        const { exec } = require('child_process');
        const sourceInputsDir = path.resolve(UPLOAD_ROOT, 'user_spaces', `user_${userId}`, 'inputs');

        const dirPath = process.env.DIR_PATH;
        const timestamp = getTimestamp();

        if (!dirPath) {
            res.status(StatusCodes.BAD_REQUEST).json({ message: 'Missing DIR_PATH' });
            return;
        }

        const engineRoot = path.resolve(dirPath);
        const destUserDir = path.join(engineRoot, 'user_spaces', `user_${userId}`);
        const destRunDir = path.join(destUserDir, `run_process_${timestamp}`);
        const destInputsDir = path.join(destRunDir, 'inputs');

        if (!fs.existsSync(destInputsDir)) {
            fs.mkdirSync(destInputsDir, { recursive: true });
        }
        
        const srcSeq = path.join(sourceInputsDir, 'seq_data');
        const srcMeta = path.join(sourceInputsDir, 'metadata');
        const destSeq = path.join(destInputsDir, 'seq_data');
        const destMeta = path.join(destInputsDir, 'metadata');

        console.log(`[Run] Moving files for User ${userId}`);

        if (fs.existsSync(srcSeq)) safeMove(srcSeq, destSeq);
        if (fs.existsSync(srcMeta)) safeMove(srcMeta, destMeta);

        ensureUserDirs(userId);

        const scriptPath = path.join(engineRoot, 'run_pipeline.sh'); 
        const command = `sh ${scriptPath}`;

        console.log(`[Run] Triggering script at: ${engineRoot}`);
        
        exec(command, { cwd: engineRoot }, (error: any, stdout: any, stderr: any) => {
            if (error) { console.error(`[Script Error]: ${error.message}`); return; }
            if (stderr) console.error(`[Script Stderr]: ${stderr}`);
            console.log(`[Script Stdout]: ${stdout}`);
        });

        res.status(StatusCodes.OK).json({ 
            message: 'Process started successfully',
            run_id: `run_process_${timestamp}`,
            destination: destRunDir
        });

    } catch (error) {
        console.error('Run Process Error:', error);
        const msg = error instanceof Error ? error.message : 'Unknown error';
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: msg });
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