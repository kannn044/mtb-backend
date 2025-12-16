import * as express from 'express';
import { Router, Request, Response, NextFunction } from 'express';

const router: Router = Router();

router.get('/', (req: Request, res: Response, next: NextFunction) => {
  res.status(200).send('Hello, world!');
});

export default router;
