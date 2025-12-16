import express from 'express';
import cors from 'cors';
import { dbMiddleware } from './middlewares/dbMiddleware'; // import มา
import { logger } from './middlewares/logger';
import userRoutes from './routes/userRoute';
import loginRoute from './routes/loginRoute';

const app = express();

app.use(logger);
app.use(cors());
app.use(express.json());

// ✅ เรียกใช้ตรงนี้! ทุก Route ที่อยู่ข้างล่างจะรู้จัก req.db ทั้งหมด
app.use(dbMiddleware);

// Example Routes
app.use('/api/users', userRoutes);
app.use('/api/login', loginRoute);

export default app;