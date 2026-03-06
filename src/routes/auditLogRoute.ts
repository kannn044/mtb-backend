import { Router } from 'express';
import { getAuditLogsByUserId } from '../controllers/auditLogController';
import { checkAuth } from '../middlewares/auth';
import { requireRole } from '../middlewares/roleAuth';

const router = Router();

// GET /api/audit-logs/user/:userId
router.get('/user/:userId', checkAuth, requireRole(['ADMIN']), getAuditLogsByUserId);

export default router;
