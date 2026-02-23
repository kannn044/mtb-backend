import { Knex } from 'knex';

export const logAudit = async (
    db: Knex,
    userId: number | null,
    action: string,
    details: string | null = null,
    ipAddress: string | null = null
): Promise<void> => {
    try {
        await db('audit_logs').insert({
            user_id: userId,
            action,
            details,
            ip_address: ipAddress,
            created_at: new Date()
        });
    } catch (error) {
        console.error('Failed to write audit log:', error);
        // We do not throw the error here to prevent the main application flow
        // (like login or upload) from failing just because logging failed.
    }
};
