import { Request, Response, NextFunction } from 'express';
import * as HttpStatus from 'http-status-codes';

export const checkAdmin = (req: Request, res: Response, next: NextFunction) => {
  const { status } = req.decoded;

  if (status !== 'ADMIN') {
    return res.status(HttpStatus.FORBIDDEN).json({
      ok: false,
      error: 'Permission denied',
    });
  }

  next();
};
