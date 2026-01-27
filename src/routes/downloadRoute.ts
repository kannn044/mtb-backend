import { Router } from 'express';
import { checkAuth } from '../middlewares/auth';
import { downloadRunZip, listRuns } from '../controllers/downloadController';

const router = Router();

router.get('/runs', checkAuth, listRuns);
router.get('/runs/:runId/zip', checkAuth, downloadRunZip);

export default router;
