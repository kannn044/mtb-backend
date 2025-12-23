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

  // แนะนำ: ควรเช็คก่อนว่ามี Token ไหม ถ้าไม่มีให้ดีด error เลย ไม่ต้องรอ verify
  if (!token) {
      return res.status(HttpStatus.UNAUTHORIZED).send({
        ok: false,
        error: 'No token provided',
        code: HttpStatus.UNAUTHORIZED
      });
  }

  jwt.verify(token) // *หมายเหตุ: ปกติ jwt.verify ของ library 'jsonwebtoken' ไม่ return Promise นะครับ (ต้องใช้ callback หรือ promisify เอา) แต่ถ้าคุณใช้ wrapper หรือ custom lib ที่เป็น promise อยู่แล้วก็โอเคครับ
    .then((decoded: any) => {
      req.decoded = decoded;
      next();
    }, err => {
      // *** จุดที่แก้ไขอยู่ตรงนี้ครับ ***
      return res.status(HttpStatus.UNAUTHORIZED).send({ // ใส่ status 401 เข้าไป
        ok: false,
        error: HttpStatus.getStatusText(HttpStatus.UNAUTHORIZED), // หรือ err.message เพื่อดู error จริง
        code: HttpStatus.UNAUTHORIZED
      });
    });
};
