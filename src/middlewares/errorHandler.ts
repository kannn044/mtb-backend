import { Request, Response, NextFunction } from 'express';
import * as HttpStatus from 'http-status-codes';

export const handleDevErrors = (err: any, req: Request, res: Response, next: NextFunction) => {
  console.log(err.stack);
  res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
    error: {
      ok: false,
      code: HttpStatus.INTERNAL_SERVER_ERROR,
      error: HttpStatus.getStatusText(HttpStatus.INTERNAL_SERVER_ERROR)
    }
  });
};

export const handleNotFound = (req: Request, res: Response, next: NextFunction) => {
  res.status(HttpStatus.NOT_FOUND).json({
    error: {
      ok: false,
      code: HttpStatus.NOT_FOUND,
      error: HttpStatus.getStatusText(HttpStatus.NOT_FOUND)
    }
  });
};
