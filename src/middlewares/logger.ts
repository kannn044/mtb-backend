import { Request, Response, NextFunction } from 'express';

export const logger = (req: Request, res: Response, next: NextFunction) => {
  const timestamp = new Date().toISOString();
  
  res.on('finish', () => {
    console.log(`${timestamp} - ${req.method} ${req.originalUrl} - ${res.statusCode}`);
  });
  
  next();
};
