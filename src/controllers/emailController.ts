import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import nodemailer from 'nodemailer';

const parseBoolean = (val: string | undefined): boolean | undefined => {
  if (val === undefined) return undefined;
  const normalized = val.trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) return false;
  return undefined;
};

const asArray = (value: unknown): string[] | undefined => {
  if (value === undefined || value === null) return undefined;
  if (Array.isArray(value)) return value.map(String).map(s => s.trim()).filter(Boolean);
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    // allow comma-separated string
    return trimmed.split(',').map(s => s.trim()).filter(Boolean);
  }
  return undefined;
};

type SendEmailBody = {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  cc?: string | string[];
  bcc?: string | string[];
  from?: string;
  replyTo?: string;
};

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

export const sendEmail = async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as Partial<SendEmailBody>;

    const to = asArray(body.to);
    const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
    const text = typeof body.text === 'string' ? body.text : undefined;
    const html = typeof body.html === 'string' ? body.html : undefined;

    if (!to || to.length === 0) {
      res.status(StatusCodes.BAD_REQUEST).json({ message: 'Missing "to"' });
      return;
    }

    if (!subject) {
      res.status(StatusCodes.BAD_REQUEST).json({ message: 'Missing "subject"' });
      return;
    }

    if (!text && !html) {
      res.status(StatusCodes.BAD_REQUEST).json({ message: 'Provide "text" or "html"' });
      return;
    }

    const transporter = createTransporter();

    const from = (typeof body.from === 'string' && body.from.trim())
      ? body.from.trim()
      : (process.env.SMTP_FROM || process.env.SMTP_USER);

    if (!from) {
      res.status(StatusCodes.BAD_REQUEST).json({ message: 'Missing "from" (set SMTP_FROM or SMTP_USER)' });
      return;
    }

    const info = await transporter.sendMail({
      from,
      to,
      subject,
      text,
      html,
      cc: asArray(body.cc),
      bcc: asArray(body.bcc),
      replyTo: typeof body.replyTo === 'string' ? body.replyTo.trim() : undefined,
    });

    res.status(StatusCodes.OK).json({
      message: 'Email sent',
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
      response: info.response,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Failed to send email', error: msg });
  }
};
