import { Router } from 'express';
import { getDashboardData } from '../controllers/dashboardController';
import { checkAuth } from '../middlewares/auth';

const router = Router();

router.get('/', checkAuth, getDashboardData);

export default router;
