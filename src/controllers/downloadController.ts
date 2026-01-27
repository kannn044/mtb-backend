import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import archiver from 'archiver';

const getUserIdFromRequest = (req: Request): string => {
  const decoded = (req as any).decoded;
  if (!decoded || decoded.id == null) {
    throw new Error('Missing decoded token payload');
  }
  return String(decoded.id);
};

const getUserRootDir = (userId: string): string => {
  const dirPath = process.env.DIR_PATH;
  if (!dirPath) {
    throw new Error('Missing DIR_PATH');
  }
  return path.resolve(dirPath, 'user_spaces', `user_${userId}`);
};

const isSafeRunId = (runId: string): boolean => {
  // Expect run_process_{uuid} (uuid often includes hyphens)
  return /^run_process_[A-Za-z0-9_-]+$/.test(runId);
};

export const listRuns = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserIdFromRequest(req);
    const userRootDir = getUserRootDir(userId);

    if (!fs.existsSync(userRootDir)) {
      return res.status(200).json({ runs: [] });
    }

    const entries = await fs.promises.readdir(userRootDir, { withFileTypes: true });

    const runs = await Promise.all(
      entries
        .filter((entry) => entry.isDirectory())
        .map(async (entry) => {
          const name = entry.name;
          if (!isSafeRunId(name)) return null;
          const fullPath = path.join(userRootDir, name);
          const stat = await fs.promises.stat(fullPath);
          return {
            id: name,
            updatedAt: stat.mtime.toISOString(),
          };
        })
    );

    const filtered = runs
      .filter((r): r is { id: string; updatedAt: string } => r !== null)
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0));

    return res.status(200).json({ runs: filtered });
  } catch (err) {
    return next(err);
  }
};

export const downloadRunZip = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserIdFromRequest(req);
    const runId = String(req.params.runId || '');

    if (!isSafeRunId(runId)) {
      return res.status(400).json({ message: 'Invalid runId' });
    }

    const userRootDir = getUserRootDir(userId);
    const runDir = path.resolve(userRootDir, runId);

    // Path traversal protection
    const userRootResolved = path.resolve(userRootDir) + path.sep;
    if (!(runDir + path.sep).startsWith(userRootResolved)) {
      return res.status(400).json({ message: 'Invalid path' });
    }

    const stat = await fs.promises.stat(runDir).catch(() => null);
    if (!stat || !stat.isDirectory()) {
      return res.status(404).json({ message: 'Run folder not found' });
    }

    const outputDir = path.join(runDir, 'output');
    const outputStat = await fs.promises.stat(outputDir).catch(() => null);
    if (!outputStat || !outputStat.isDirectory()) {
      return res.status(404).json({ message: 'Output folder not found' });
    }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${runId}.zip"`);

    const archive = archiver('zip', { zlib: { level: 9 } });

    archive.on('error', (archiveErr) => {
      next(archiveErr);
    });

    archive.pipe(res);
    // Zip everything *inside* output/ at the zip root
    archive.directory(outputDir, false);

    await archive.finalize();
  } catch (err) {
    return next(err);
  }
};
