import express from 'express';
import cors from 'cors';
import { dbMiddleware } from './middlewares/dbMiddleware'; // import มา
import { logger } from './middlewares/logger';
import userRoute from './routes/userRoute';
import loginRoute from './routes/loginRoute';
import txtRoute from './routes/txtRoute';
import uploadRoute from './routes/uploadRoute';
import emailRoute from './routes/emailRoute';
import dashboardRoute from './routes/dashboardRoute';
import downloadRoute from './routes/downloadRoute';

const app = express();

app.use(logger);
const corsOptions = {
  origin: 'http://203.157.84.69:3000',
  optionsSuccessStatus: 200, // some legacy browsers (IE11, various SmartTVs) choke on 204
};

app.use(cors(corsOptions));
app.use(express.json());

// ✅ เรียกใช้ตรงนี้! ทุก Route ที่อยู่ข้างล่างจะรู้จัก req.db ทั้งหมด
app.use(dbMiddleware);

app.use('/api/users', userRoute);
app.use('/api/login', loginRoute);
app.use('/api/txt', txtRoute);
app.use('/api/upload', uploadRoute);
app.use('/api/email', emailRoute);
app.use('/api/dashboard', dashboardRoute);
app.use('/api/download', downloadRoute);

export default app;