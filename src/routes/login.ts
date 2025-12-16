import * as express from 'express';
import { Router, Request, Response, NextFunction } from 'express';

const router: Router = Router();

router.post('/', (req: Request, res: Response, next: NextFunction) => {
  // Your login logic here
  res.json({ ok: true });
});

export default router;
