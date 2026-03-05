import { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';
import { Jwt } from '../models/jwt';
import dbInstance from '../config/db';
import { logAudit } from '../utils/auditLogger'; // NEW IMPORT

export const loginController = async (req: Request, res: Response, next: NextFunction) => {
  const { username, password, rememberMe } = req.body;

  if (!username || !password) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const ipAddress = req.ip || req.socket.remoteAddress || 'Unknown';

  try {
    // 1. Check if user exists first to get lockout status
    const userRecord = await dbInstance('users').where({ username }).first();

    if (!userRecord) {
      await logAudit(dbInstance, null, 'LOGIN_FAILED', `Attempt with unknown username: ${username}`, ipAddress);
      return res.status(401).json({ message: 'Invalid credentials' }); // Generic message for security
    }

    // 2. Check if account is currently locked
    if (userRecord.lock_until && new Date() < new Date(userRecord.lock_until)) {
      const lockTimeRemaining = Math.ceil((new Date(userRecord.lock_until).getTime() - new Date().getTime()) / 60000);
      await logAudit(dbInstance, userRecord.id, 'LOGIN_LOCKED_ATTEMPT', `Attempted to login while account is locked`, ipAddress);
      return res.status(403).json({ message: `Account is temporarily locked. Please try again in ${lockTimeRemaining} minutes.` });
    }

    // 3. Verify Password
    const passwordHash = crypto.createHash('md5').update(password).digest('hex');
    
    if (userRecord.password !== passwordHash) {
      // Password Incorrect
      const newFailedAttempts = (userRecord.failed_login_attempts || 0) + 1;
      let lockUntil = null;

      if (newFailedAttempts >= 5) {
        // Lock account for 15 minutes
        lockUntil = new Date(Date.now() + 15 * 60 * 1000);
        await logAudit(dbInstance, userRecord.id, 'ACCOUNT_LOCKED', `Account locked due to 5 failed login attempts`, ipAddress);
      }

      await dbInstance('users').where({ id: userRecord.id }).update({
        failed_login_attempts: newFailedAttempts,
        lock_until: lockUntil
      });

      await logAudit(dbInstance, userRecord.id, 'LOGIN_FAILED', `Incorrect password attempt (${newFailedAttempts}/5)`, ipAddress);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // 4. Password Correct - Reset Lockout
    await dbInstance('users').where({ id: userRecord.id }).update({
      failed_login_attempts: 0,
      lock_until: null
    });

    // 5. Generate JWT
    const jwt = new Jwt();
    const payload = {
      id: userRecord.id,
      name: userRecord.name,
      email: userRecord.email,
      lastname: userRecord.lastname,
      username: userRecord.username,
      status: userRecord.status,
      organization: userRecord.organization
    };
    
    // Determine token expiration based on rememberMe (handled in jwt.ts or set inline)
    // Assuming Jwt class defaults to 24h, we pass custom expiry if supported, else default to 30d/1d manually
    const expiresIn = rememberMe ? '30d' : '1d';
    const token = jwt.sign(payload, { expiresIn }); // Assuming jwt.sign takes options, if not we modify jwt.ts next

    await logAudit(dbInstance, userRecord.id, 'LOGIN_SUCCESS', `User ${username} logged in successfully`, ipAddress);

    res.status(200).json({ token });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
