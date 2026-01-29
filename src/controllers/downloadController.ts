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

const getOverallReportDir = (runDir: string): string => {
  return path.join(runDir, 'outputs', 'user_reports', '7_WGS_cluster_reports', 'overall_report');
};

const isPathInside = (childPath: string, parentPath: string): boolean => {
  const parentResolved = path.resolve(parentPath) + path.sep;
  const childResolved = path.resolve(childPath) + path.sep;
  return childResolved.startsWith(parentResolved);
};

const parsePipelineExecutionLog = (content: string): { status?: string; endTimeRaw?: string } => {
  const statusMatch = content.match(/^\s*Status\s*:\s*(.+?)\s*$/mi);
  const endTimeMatch = content.match(/^\s*End Time\s*:\s*(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\s*$/mi);

  const status = statusMatch?.[1]?.trim();

  const endTimeRaw = endTimeMatch?.[1]?.trim();
  return { status, endTimeRaw };
};

const pad2 = (n: number): string => String(n).padStart(2, '0');

const formatLocalYmdHms = (d: Date): string => {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
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

          const logPath = path.join(fullPath, 'outputs', 'user_reports', 'pipeline_execution.log');
          const logStat = await fs.promises.stat(logPath).catch(() => null);
          if (logStat?.isFile()) {
            const content = await fs.promises.readFile(logPath, 'utf8').catch(() => '');
            const parsed = parsePipelineExecutionLog(content);

            const endTimeDate = parsed.endTimeRaw ? new Date(parsed.endTimeRaw.replace(' ', 'T')) : null;
            const endTimeMs = endTimeDate && !Number.isNaN(endTimeDate.getTime()) ? endTimeDate.getTime() : logStat.mtime.getTime();

            return {
              id: name,
              status: parsed.status || 'PROCESSING',
              updatedAt: parsed.endTimeRaw || formatLocalYmdHms(logStat.mtime),
              overallReportUrl: `/api/download/runs/${name}/report/overall/overall_wgs_cluster_summary_report.html`,
              updatedAtMs: endTimeMs,
            };
          }

          return {
            id: name,
            status: 'PROCESSING',
            updatedAt: formatLocalYmdHms(stat.mtime),
            overallReportUrl: `/api/download/runs/${name}/report/overall/overall_wgs_cluster_summary_report.html`,
            updatedAtMs: stat.mtime.getTime(),
          };
        })
    );

    const filtered = runs
      .filter(
        (r): r is { id: string; status: string; updatedAt: string; overallReportUrl: string; updatedAtMs: number } => r !== null
      )
      .sort((a, b) => b.updatedAtMs - a.updatedAtMs)
      .map(({ updatedAtMs, ...rest }) => rest);

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

    const outputDir = path.join(runDir, 'outputs');
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

export const previewOverallReportFile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserIdFromRequest(req);
    const runId = String(req.params.runId || '');
    const filePathParam = String((req.params as any).filePath || '');

    if (!isSafeRunId(runId)) {
      return res.status(400).json({ message: 'Invalid runId' });
    }

    const userRootDir = getUserRootDir(userId);
    const runDir = path.resolve(userRootDir, runId);
    if (!isPathInside(runDir, userRootDir)) {
      return res.status(400).json({ message: 'Invalid path' });
    }

    const reportDir = getOverallReportDir(runDir);
    const reportDirStat = await fs.promises.stat(reportDir).catch(() => null);
    if (!reportDirStat || !reportDirStat.isDirectory()) {
      return res.status(404).json({ message: 'Report folder not found' });
    }

    // Prevent path traversal and always resolve inside overall_report/
    const requestedFile = filePathParam.replace(/^\/+/, '');
    const filePath = path.resolve(reportDir, requestedFile);
    if (!isPathInside(filePath, reportDir)) {
      return res.status(400).json({ message: 'Invalid path' });
    }

    const stat = await fs.promises.stat(filePath).catch(() => null);
    if (!stat || !stat.isFile()) {
      return res.status(404).json({ message: 'File not found' });
    }

    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    return res.sendFile(filePath);
  } catch (err) {
    return next(err);
  }
};
