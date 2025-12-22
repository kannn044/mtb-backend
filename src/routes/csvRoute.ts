import { Router } from 'express';
import { getCsvData } from '../controllers/csvController';

const router = Router();

router.get('/', getCsvData);

export default router;
