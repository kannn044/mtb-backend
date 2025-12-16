import knex from 'knex';
import dotenv from 'dotenv';

dotenv.config();

// ตั้งค่า Connection ตรงนี้เลย (ไม่ต้องใช้ knexfile ก็ได้ถ้าไม่รัน migration)
const dbInstance = knex({
  client: 'mysql2',
  connection: {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '1234',
    database: process.env.DB_NAME || 'test',
    port: Number(process.env.DB_PORT) || 3306
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
    console.log('✅ MySQL Connected via Knex');
}).catch((err) => {
    console.error('❌ MySQL Connection Error:', err);
});

export default dbInstance;