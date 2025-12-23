import { Request, Response } from 'express';
import crypto from 'crypto';

export const getUsers = async (req: Request, res: Response) => {
    try {
        // ใช้ req.db ที่เราทำ middleware ไว้
        // สำคัญ: ตรวจสอบชื่อ column ให้ตรงกับใน Database จริงของคุณนะครับ
        const users = await req.db('users')
            .select(
                'id',
                'username',
                'name',
                'lastname',
                'status',
                'is_active',
                'created_date',
                'updated_date'
            )
            .whereNot({ status: 'ADMIN' })
            .orderBy('created_date', 'asc'); // เรียงจากใหม่ไปเก่า

        // ส่งข้อมูลกลับไปเป็น JSON
        res.status(200).json(users);

    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};



export const createUser = async (req: Request, res: Response) => {
    try {
        const { username, password, name, lastname, is_active, status } = req.body;

        if (!username || !password) {
            return res.status(400).json({ message: 'Username and password are required' });
        }

        const hashedPassword = crypto.createHash('md5').update(password).digest('hex');

        const [id] = await req.db('users').insert({
            username,
            password: hashedPassword,
            name,
            lastname: lastname,
            is_active,
            status,
            created_date: new Date()
        });

        res.status(201).json({ "id": id, username });

    } catch (error: any) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'Duplicate Username' });
        }
        console.error('Error registering user:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

export const updateUser = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { name, lastname, is_active, status } = req.body;

        const [user] = await req.db('users').where('id', id).select('id');

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        await req.db('users').where('id', id).update({
            name,
            lastname,
            is_active,
            status,
            updated_date: new Date()
        });

        res.status(200).json({ message: 'User updated successfully' });

    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

export const deleteUser = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const [user] = await req.db('users').where('id', id).select('id');

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        await req.db('users').where('id', id).update({
            is_active: 'N',
            updated_date: new Date()
        });

        res.status(200).json({ message: 'User deleted successfully' });

    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};
