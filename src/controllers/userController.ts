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
                'email',
                'name',
                'lastname',
                'organization',
                'status',
                'is_active',
                'is_approve',
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
        const { username, password, email, name, lastname, organization, is_active, status } = req.body;

        if (!username || !password) {
            return res.status(400).json({ message: 'Username and password are required' });
        }

        if (email && typeof email === 'string') {
            const trimmed = email.trim();
            // minimal email format check (avoid blocking uncommon but valid emails)
            if (trimmed.length > 254 || !/^\S+@\S+\.\S+$/.test(trimmed)) {
                return res.status(400).json({ message: 'Invalid email' });
            }
        }

        // Check for duplicate username
        const existingUsername = await req.db('users').where({ username }).first();
        if (existingUsername) {
            return res.status(409).json({ message: 'Username is already taken.' });
        }

        // Check for duplicate email
        if (email) {
            const existingEmail = await req.db('users').where({ email: email.trim() }).first();
            if (existingEmail) {
                return res.status(409).json({ message: 'Email is already registered.' });
            }
        }

        const hashedPassword = crypto.createHash('md5').update(password).digest('hex');

        const [id] = await req.db('users').insert({
            username,
            email,
            password: hashedPassword,
            name,
            lastname: lastname,
            organization: organization || null,
            is_active,
            status,
            created_date: new Date()
        });

        res.status(201).json({ "id": id, username });

    } catch (error: any) {
        if (error.code === 'ER_DUP_ENTRY') {
            const msg = error.message?.includes('email') ? 'Email is already registered.' : 'Username is already taken.';
            return res.status(409).json({ message: msg });
        }
        console.error('Error registering user:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

export const updateUser = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { email, name, lastname, organization, is_active, is_approve, status, password } = req.body;

        const [user] = await req.db('users').where('id', id).select('id');

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (email !== undefined) {
            if (email === null) {
                // allow clearing email
            } else if (typeof email !== 'string') {
                return res.status(400).json({ message: 'Invalid email' });
            } else {
                const trimmed = email.trim();
                if (trimmed.length > 254 || !/^\S+@\S+\.\S+$/.test(trimmed)) {
                    return res.status(400).json({ message: 'Invalid email' });
                }
            }
        }

        const updateData: Record<string, any> = {
            updated_date: new Date(),
        };

        if (email !== undefined) updateData.email = email;
        if (name !== undefined) updateData.name = name;
        if (lastname !== undefined) updateData.lastname = lastname;
        if (organization !== undefined) updateData.organization = organization;
        if (is_active !== undefined) updateData.is_active = is_active;
        if (status !== undefined) updateData.status = status;
        if (is_approve !== undefined) updateData.is_approve = is_approve;
        if (password) {
            updateData.password = crypto.createHash('md5').update(password).digest('hex');
        }

        await req.db('users').where('id', id).update({
            ...updateData
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
