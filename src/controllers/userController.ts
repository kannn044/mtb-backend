import { Request, Response } from 'express';

export const getUsers = async (req: Request, res: Response) => {
    try {
        // ใช้ req.db ที่เราทำ middleware ไว้
        // สำคัญ: ตรวจสอบชื่อ column ให้ตรงกับใน Database จริงของคุณนะครับ
        const users = await req.db('users')
            .select(
                'id',
                'username',
                'password',
                'status',
                'is_active',
                'created_date'
            )
            .orderBy('created_date', 'desc'); // เรียงจากใหม่ไปเก่า

        // ส่งข้อมูลกลับไปเป็น JSON
        res.status(200).json(users);

    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};