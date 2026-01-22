import knex from 'knex';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const parseBoolean = (val: string | undefined): boolean | undefined => {
  if (val === undefined) return undefined;
  const normalized = val.trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) return false;
  return undefined;
};

const readCaFromEnv = (): string | undefined => {
  const caInline = process.env.DB_SSL_CA?.trim();
  if (caInline) {
    // Allow storing PEM in env with \n escapes.
    return caInline.replace(/\\n/g, '\n');
  }

  const caFilePath = process.env.DB_SSL_CA_FILE?.trim();
  if (!caFilePath) return undefined;
  try {
    return fs.readFileSync(caFilePath, 'utf8');
  } catch (e) {
    console.warn('⚠️  Failed to read DB_SSL_CA_FILE:', e);
    return undefined;
  }
};

const dbHost = process.env.DB_HOST || 'localhost';
const isTiDBCloud = dbHost.includes('tidbcloud.com');
const dbPort = Number(process.env.DB_PORT) || (isTiDBCloud ? 4000 : 3306);

// TiDB Cloud requires TLS; default to SSL when host looks like TiDB Cloud.
const enableSsl = parseBoolean(process.env.DB_SSL) ?? isTiDBCloud;
const rejectUnauthorized = parseBoolean(process.env.DB_SSL_REJECT_UNAUTHORIZED) ?? true;
const sslCa = readCaFromEnv();
const ssl = enableSsl
  ? {
      minVersion: 'TLSv1.2',
      rejectUnauthorized,
      ...(sslCa ? { ca: sslCa } : {}),
    }
  : undefined;

// ตั้งค่า Connection ตรงนี้เลย (ไม่ต้องใช้ knexfile ก็ได้ถ้าไม่รัน migration)
const dbInstance = knex({
  client: 'mysql2',
  connection: {
    host: dbHost,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'test',
    port: dbPort,
    ...(ssl ? { ssl } : {})
  },
  pool: {
    min: 2,
    max: 10 // รองรับ connection พร้อมกันสูงสุด 10 connections
  },
  // log query ดูว่ามันยิง sql อะไรไปบ้าง (มีประโยชน์ตอน dev)
  debug: process.env.NODE_ENV === 'development', 
});

// Test Connection เบาๆ ตอนเริ่ม
dbInstance.raw('SELECT 1').then(() => {
  console.log('✅ DB Connected via Knex');
}).catch((err) => {
  console.error('❌ DB Connection Error:', err);
});

export default dbInstance;