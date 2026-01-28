import { Request, Response } from 'express';
import crypto from 'crypto';

export const changePassword = async (req: Request, res: Response) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const userId = req.decoded.id; // Get user ID from the authenticated token

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ message: 'Current password and new password are required.' });
        }

        // Validate new password (simple check for now)
        if (newPassword.length < 6) { // Example: minimum 6 characters
            return res.status(400).json({ message: 'New password must be at least 6 characters long.' });
        }
        if (currentPassword === newPassword) {
            return res.status(400).json({ message: 'New password cannot be the same as the current password.' });
        }


        // Fetch user from database to verify current password
        const user = await req.db('users').where({ id: userId }).first();

        if (!user) {
            return res.status(404).json({ message: 'User not found.' }); // Should not happen if auth is successful
        }

        // Compare hashed current password with stored password
        const hashedCurrentPassword = crypto.createHash('md5').update(currentPassword).digest('hex');

        if (hashedCurrentPassword !== user.password) {
            return res.status(401).json({ message: 'Incorrect current password.' });
        }

        // Hash the new password
        const hashedNewPassword = crypto.createHash('md5').update(newPassword).digest('hex');

        // Update password in the database
        await req.db('users').where({ id: userId }).update({
            password: hashedNewPassword,
            updated_date: new Date()
        });

        res.status(200).json({ message: 'Password changed successfully.' });

    } catch (error: any) {
        console.error('Error changing password:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};