import express from 'express';
import cors from 'cors';
import { dbMiddleware } from './middlewares/dbMiddleware'; // import มา
import { logger } from './middlewares/logger';
import userRoute from './routes/userRoute';
import loginRoute from './routes/loginRoute';
import csvRoute from './routes/csvRoute';

const app = express();

app.use(logger);
app.use(cors());
app.use(express.json());

// ✅ เรียกใช้ตรงนี้! ทุก Route ที่อยู่ข้างล่างจะรู้จัก req.db ทั้งหมด
app.use(dbMiddleware);

app.use('/api/users', userRoute);
app.use('/api/login', loginRoute);
app.use('/api/csv', csvRoute);

export default app;