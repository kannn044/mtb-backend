import { Router, Request, Response, NextFunction } from 'express';
import txtRouter from './txtRoute';

const router: Router = Router();
router.use('/txt', txtRouter);

router.get('/', (req: Request, res: Response, next: NextFunction) => {
  res.status(200).send('Hello, world!');
});

export default router;
