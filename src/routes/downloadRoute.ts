import { Router } from 'express';
import { checkAuth } from '../middlewares/auth';
import { downloadRunZip, listRuns, previewOverallReportFile } from '../controllers/downloadController';

const router = Router();

router.get('/runs', checkAuth, listRuns);
router.get('/runs/:runId/zip', checkAuth, downloadRunZip);
// Serves HTML report and its assets under overall_report/
router.get('/runs/:runId/report/overall/*filePath', checkAuth, previewOverallReportFile);

export default router;
