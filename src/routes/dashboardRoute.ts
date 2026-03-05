import { Router } from 'express';
import { getDashboardData, previewPreexistingClusterReportFile } from '../controllers/dashboardController';
// Removed checkAuth so Dashboard API is public for VIEWERS

const router = Router();

router.get('/', getDashboardData);
router.use('/report/cluster-view', previewPreexistingClusterReportFile);

export default router;
