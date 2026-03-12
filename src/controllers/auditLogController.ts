import { Request, Response } from 'express';

export const getAuditLogsByUserId = async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;

        const logs = await req.db('audit_logs')
            .where({ user_id: userId })
            .orderBy('created_at', 'desc')
            .limit(50)
            .select('id', 'user_id', 'action', 'details', 'ip_address', 'created_at');

        res.status(200).json(logs);
    } catch (error) {
        console.error('Error fetching audit logs:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};
