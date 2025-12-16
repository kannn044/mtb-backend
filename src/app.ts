import express from 'express';
import cors from 'cors';
import { dbMiddleware } from './middlewares/dbMiddleware'; // import มา
import userRoutes from './routes/userRoute';

const app = express();

app.use(cors());
app.use(express.json());

// ✅ เรียกใช้ตรงนี้! ทุก Route ที่อยู่ข้างล่างจะรู้จัก req.db ทั้งหมด
app.use(dbMiddleware);

// Example Routes
app.use('/api/users', userRoutes);

export default app;