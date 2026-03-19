import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const parseBoolean = (val: string | undefined): boolean | undefined => {
  if (val === undefined) return undefined;
  const normalized = val.trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) return false;
  return undefined;
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

export const sendPipelineFinishedEmail = async (opts: {
  to: string;
  userLabel: string;
  runId: string;
  success: boolean;
}): Promise<void> => {
  const from = (process.env.SMTP_FROM || process.env.SMTP_USER || '').trim();
  if (!from) throw new Error('Missing SMTP_FROM or SMTP_USER');

  const subject = opts.success
    ? `[MTB] Pipeline finished: ${opts.runId}`
    : `[MTB] Pipeline failed: ${opts.runId}`;

  const baseUrl = (process.env.APP_BASE_URL || 'https://poc.moph.go.th/mtbcluster').replace(/\/+$/, '');
  const previewUrl = `${baseUrl}/api/download/runs/${opts.runId}/report/cluster-view/overall_report/overall_wgs_cluster_summary_report.html`;
  const text =
    `Hello ${opts.userLabel},\n\n` +
    `Your pipeline run has finished.\n` +
    `Run ID: ${opts.runId}\n` +
    `Result: ${opts.success ? 'SUCCESS' : 'FAILED'}\n\n` +
    `If successful, you can preview the report at:\n` +
    `${previewUrl}\n`;

  const transporter = createTransporter();
  await transporter.sendMail({
    from,
    to: opts.to,
    subject,
    text,
  });
};

export const sendFastaDetectedEmail = async (opts: {
  to: string;
  userLabel: string;
}): Promise<void> => {
  const from = (process.env.SMTP_FROM || process.env.SMTP_USER || '').trim();
  if (!from) throw new Error('Missing SMTP_FROM or SMTP_USER');

  const subject = '[MTB] FASTA file detected — pipeline aborted';
  const text =
    `Hello ${opts.userLabel},\n\n` +
    `At least one FASTA file has been detected. Current pipeline cannot analyse FASTA sequence data yet. Please remove them from your input.\n`;

  const transporter = createTransporter();
  await transporter.sendMail({ from, to: opts.to, subject, text });
};
