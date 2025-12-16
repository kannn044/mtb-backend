import { Request, Response, NextFunction } from 'express';
import dbInstance from '../config/db';

export const dbMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // แนบ db instance ไปกับ request object
  req.db = dbInstance;
  
  // ไปทำงานต่อ
  next();
};