import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser'; // 🔥 1. Import เข้ามา
import { dbMiddleware } from './middlewares/dbMiddleware'; // import มา
import { logger } from './middlewares/logger';
import userRoute from './routes/userRoute';
import loginRoute from './routes/loginRoute';
import txtRoute from './routes/txtRoute';
import uploadRoute from './routes/uploadRoute';
import emailRoute from './routes/emailRoute';
import dashboardRoute from './routes/dashboardRoute';
import downloadRoute from './routes/downloadRoute';
import registerRoute from './routes/registerRoute';
import passwordRoute from './routes/passwordRoute';
import auditLogRoute from './routes/auditLogRoute';
import { handleDevErrors, handleNotFound } from './middlewares/errorHandler';

const app = express();

app.use(logger);
const corsOptions = {
  origin: ['http://10.1.1.171:3000', 'https://poc.moph.go.th'],
  credentials: true,
  optionsSuccessStatus: 200, // some legacy browsers (IE11, various SmartTVs) choke on 204
};

app.use(cors(corsOptions));
// app.use(express.json());
app.use(express.json({ limit: '1024mb' })); // เพิ่มขนาดไฟล์ที่รับได้
app.use(express.urlencoded({ limit: '1024mb', extended: true })); // เพิ่มขนาดไฟล์ที่รับได้ และรองรับการเข้ารหัสแบบ extended
app.use(cookieParser());

// ✅ เรียกใช้ตรงนี้! ทุก Route ที่อยู่ข้างล่างจะรู้จัก req.db ทั้งหมด
app.use(dbMiddleware);

app.get('/', (req, res) => {
  res.send('MTB Backend is running.');
});

app.use('/api/users', userRoute);
app.use('/api/login', loginRoute);
app.use('/api/txt', txtRoute);
app.use('/api/upload', uploadRoute);
app.use('/api/email', emailRoute);
app.use('/api/dashboard', dashboardRoute);
app.use('/api/download', downloadRoute);
app.use('/api/register', registerRoute);
app.use('/api/password', passwordRoute);
app.use('/api/audit-logs', auditLogRoute);

// Must be after all routes
app.use(handleNotFound);
app.use(handleDevErrors);

export default app;