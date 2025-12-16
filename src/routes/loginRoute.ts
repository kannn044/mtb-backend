import * as express from 'express';
import { Router } from 'express';
import { loginController } from '../controllers/loginController';

const router: Router = Router();

router.post('/', loginController);

export default router;
