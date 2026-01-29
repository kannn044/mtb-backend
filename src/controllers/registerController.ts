import { Request, Response } from 'express';
import crypto from 'crypto';
import nodemailer from 'nodemailer';

// Helper function to generate a random password
const generatePassword = (length = 12) => {
    return crypto.randomBytes(Math.ceil(length / 2))
        .toString('hex')
        .slice(0, length);
};

// Replicated from emailController.ts to avoid refactoring existing code
const parseBoolean = (val: string | undefined): boolean | undefined => {
    if (val === undefined) return undefined;
    const normalized = val.trim().toLowerCase();
    if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) return false;
    return undefined;
};

// Replicated from emailController.ts
const createTransporter = () => {
    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const port = Number(process.env.SMTP_PORT) || 587;
  
    if (!host) throw new Error('Missing SMTP_HOST');
  
    const secure = parseBoolean(process.env.SMTP_SECURE) ?? port === 465;
    const rejectUnauthorized = parseBoolean(process.env.SMTP_REJECT_UNAUTHORIZED) ?? true;
  
    return nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user && pass ? { user, pass } : undefined,
      tls: {
        minVersion: 'TLSv1.2',
        rejectUnauthorized,
      },
    });
};


export const registerUser = async (req: Request, res: Response) => {
    try {
        const { username, email, name, lastname } = req.body;

        if (!username || !email || !name || !lastname) {
            return res.status(400).json({ message: 'Username, email, name, and lastname are required' });
        }

        // Add email validation
        if (typeof email === 'string') {
            const trimmed = email.trim();
            // minimal email format check (avoid blocking uncommon but valid emails)
            if (trimmed.length > 254 || !/^\S+@\S+\.\S+$/.test(trimmed)) {
                return res.status(400).json({ message: 'Invalid email' });
            }
        } else {
            return res.status(400).json({ message: 'Invalid email' });
        }

        const password = generatePassword();
        const hashedPassword = crypto.createHash('md5').update(password).digest('hex');

        // Insert user into database
        await req.db('users').insert({
            username,
            email,
            password: hashedPassword,
            name,
            lastname,
            is_active: 'Y',
            status: 'USER',
            created_date: new Date()
        });

        // Send password to user's email
        const transporter = createTransporter();
        const from = process.env.SMTP_FROM || process.env.SMTP_USER;
        
        if (!from) {
            console.error('Cannot send registration email: Missing "from" address (set SMTP_FROM or SMTP_USER)');
            // Still return success to the user, but log the error
            return res.status(201).json({ message: 'User registered successfully, but failed to send email.' });
        }

        await transporter.sendMail({
            from,
            to: email,
            subject: 'Your account has been created',
            text: `Hello ${name}, your password is: ${password}`,
            html: `<p>Hello ${name},</p><p>Your password is: <b>${password}</b></p>`
        });

        res.status(201).json({ message: 'User registered successfully. Please check your email for the password.' });

    } catch (error: any) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'Username or email is already registered.' });
        }
        console.error('Error registering user:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};
