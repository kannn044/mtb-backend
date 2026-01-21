import dotenv from 'dotenv';
import mysql from 'mysql2';

dotenv.config();

// TiDB (MySQL-compatible) connection
const connection = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: 4000,
  // ----------------------------------------
  // ต้องเพิ่มก้อนนี้ครับ TiDB ถึงจะยอมให้เข้า
  // ----------------------------------------
  ssl: {
    minVersion: 'TLSv1.2',
    rejectUnauthorized: true,
  },
});

export default connection;
