import fs from 'fs';
import os from 'os';
import path from 'path';

const isServerlessRuntime = (): boolean => {
  return Boolean(
    process.env.VERCEL ||
      process.env.AWS_LAMBDA_FUNCTION_NAME ||
      process.env.LAMBDA_TASK_ROOT ||
      process.env.NETLIFY
  );
};

const normalizePath = (dirPath: string): string => {
  return path.isAbsolute(dirPath) ? dirPath : path.resolve(process.cwd(), dirPath);
};

/**
 * Returns a writable base directory for uploads and ensures it exists.
 *
 * - If `UPLOAD_DIR` is set, uses it (absolute or relative to `process.cwd()`).
 * - On serverless runtimes, defaults to `/tmp/uploads`.
 * - Otherwise defaults to `<cwd>/uploads`.
 */
export const getUploadBaseDir = (): string => {
  const configured = process.env.UPLOAD_DIR?.trim();

  const tmpUploads = path.join(os.tmpdir(), 'uploads');
  const defaultDir = isServerlessRuntime() ? tmpUploads : path.resolve(process.cwd(), 'uploads');

  const candidates = Array.from(
    new Set([
      ...(configured ? [normalizePath(configured)] : []),
      defaultDir,
      tmpUploads,
    ])
  );

  let lastError: unknown;
  for (const candidate of candidates) {
    try {
      fs.mkdirSync(candidate, { recursive: true });
      return candidate;
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Unable to create upload directory');
};

export const ensureDirSync = (dirPath: string): void => {
  fs.mkdirSync(dirPath, { recursive: true });
};
