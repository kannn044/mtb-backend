import { Router } from 'express';
import { checkAuth } from '../middlewares/auth';
import { requireRole } from '../middlewares/roleAuth';
import { downloadRunZip, listRuns, previewOverallReportFile } from '../controllers/downloadController';

const router = Router();

router.get('/runs', checkAuth, requireRole(['ADMIN', 'UPLOADER']), listRuns);
router.get('/runs/:runId/zip', checkAuth, requireRole(['ADMIN', 'UPLOADER']), downloadRunZip);
router.use('/runs/:runId/report/cluster-view', checkAuth, requireRole(['ADMIN', 'UPLOADER']), previewOverallReportFile);

export default router;