import { Router } from 'express';
import { getDashboardData, previewPreexistingClusterReportFile } from '../controllers/dashboardController';
import { checkAuth } from '../middlewares/auth';

const router = Router();

router.get('/', checkAuth, getDashboardData);
router.use('/report/cluster-view', previewPreexistingClusterReportFile);

export default router;
