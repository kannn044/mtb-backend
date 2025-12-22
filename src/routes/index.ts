import { Router, Request, Response, NextFunction } from 'express';
import csvRouter from './csvRoute';

const router: Router = Router();

router.use('/csv', csvRouter);

router.get('/', (req: Request, res: Response, next: NextFunction) => {
  res.status(200).send('Hello, world!');
});

export default router;
