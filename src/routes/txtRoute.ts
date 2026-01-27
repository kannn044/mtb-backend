import { Router } from 'express';
import { getCsvData } from '../controllers/csvController';

const router = Router();

// Returns parsed metadata.txt (TSV) from DIR_PATH/preexisting_db/<latest>
router.get('/', getCsvData);

export default router;
