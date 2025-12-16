import { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';
import { Jwt } from '../models/jwt';
import dbInstance from '../config/db';

export const loginController = async (req: Request, res: Response, next: NextFunction) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  try {
    const passwordHash = crypto.createHash('md5').update(password).digest('hex');
    
    const user = await dbInstance('users')
      .where({
        username: username,
        password: passwordHash,
      })
      .first();

    if (!user) {
      return res.status(401).json({ message: 'Login failed' });
    }

    const jwt = new Jwt();
    const payload = {
      name: user.name,
      lastname: user.lastname,
      username: user.username,
      status: user.status,
    };
    const token = jwt.sign(payload);

    res.status(200).json({ token });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
