import { Request, Response, NextFunction } from 'express';
import * as HttpStatus from 'http-status-codes';



/**
 * Middleware to check if the user has one of the allowed roles.
 * Must be used AFTER the `checkAuth` middleware which sets `req.decoded`.
 * 
 * @param allowedRoles Array of allowed roles (e.g., ['ADMIN', 'UPLOADER'])
 */
export const requireRole = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.decoded || !req.decoded.status) {
      return res.status(HttpStatus.UNAUTHORIZED).json({
        ok: false,
        error: 'Authentication required or invalid token payload',
      });
    }

    const userRole = req.decoded.status.toUpperCase();

    if (!allowedRoles.includes(userRole)) {
      return res.status(HttpStatus.FORBIDDEN).json({
        ok: false,
        error: `Permission denied. Required one of: ${allowedRoles.join(', ')}`,
      });
    }

    next();
  };
};
