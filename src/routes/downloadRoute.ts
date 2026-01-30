import { Router } from 'express';
import { checkAuth } from '../middlewares/auth';
import { downloadRunZip, listRuns, previewOverallReportFile } from '../controllers/downloadController';

const router = Router();

router.get('/runs', checkAuth, listRuns);
router.get('/runs/:runId/zip', checkAuth, downloadRunZip);
router.use('/runs/:runId/report/cluster-view', checkAuth, previewOverallReportFile);

export default router;