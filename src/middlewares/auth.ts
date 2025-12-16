import { Request, Response, NextFunction } from 'express';
import * as HttpStatus from 'http-status-codes';
import { Jwt } from '../models/jwt';

const jwt = new Jwt();

export const checkAuth = (req: Request, res: Response, next: NextFunction) => {
  let token: any = '';

  if (req.headers.authorization && req.headers.authorization.split(' ')[0] === 'Bearer') {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.query && req.query.token) {
    token = req.query.token
  } else {
    token = req.body.token;
  }

  jwt.verify(token)
    .then((decoded: any) => {
      req.decoded = decoded;
      next();
    }, err => {
      return res.send({
        ok: false,
        error: HttpStatus.getStatusText(HttpStatus.UNAUTHORIZED),
        code: HttpStatus.UNAUTHORIZED
      });
    });
};
