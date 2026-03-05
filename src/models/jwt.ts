import * as jwt from 'jsonwebtoken';

export class Jwt {
  private secretKey = process.env.JWT_SECRET || 'your-secret-key';

  sign(payload: any, options?: jwt.SignOptions) {
    return jwt.sign(payload, this.secretKey, options);
  }

  verify(token: string) {
    return new Promise((resolve, reject) => {
      jwt.verify(token, this.secretKey, (err, decoded) => {
        if (err) {
          reject(err);
        } else {
          resolve(decoded);
        }
      });
    });
  }
}
