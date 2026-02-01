import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import { StatusCodes } from 'http-status-codes';

import { resolveLatestPreexistingMetadata } from '../utils/preexistingDb';
import { parseMetadataFile } from '../utils/metadataFile';

const isPathInside = (childPath: string, parentPath: string): boolean => {
  const parentResolved = path.resolve(parentPath) + path.sep;
  const childResolved = path.resolve(childPath) + path.sep;
  return childResolved.startsWith(parentResolved);
};

export const getDashboardData = async (req: Request, res: Response): Promise<void> => {
  try {
    const version = resolveLatestPreexistingMetadata(process.env.DIR_PATH || '');

    const parsed = await parseMetadataFile(version.metadataPath);

    res.status(StatusCodes.OK).json({
      source: {
        dirPath: process.env.DIR_PATH,
        version: version.dirName,
        date: version.date,
        revision: version.revision,
        delimiter: parsed.delimiter,
      },
      count: parsed.rows.length,
      data: parsed.rows,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Failed to load dashboard data', error: msg });
  }
};

export const previewPreexistingClusterReportFile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (req.method !== 'GET') {
    return next();
  }

  try {
    const rawPath = req.path;

    if (!rawPath || rawPath === '/') {
      res.status(StatusCodes.BAD_REQUEST).json({ message: 'Missing file path' });
      return;
    }

    const version = resolveLatestPreexistingMetadata(process.env.DIR_PATH || '');
    const reportRootDir = path.join(version.versionDir, 'WGS_cluster_reports');

    const reportStat = await fs.promises.stat(reportRootDir).catch(() => null);
    if (!reportStat || !reportStat.isDirectory()) {
      res.status(StatusCodes.NOT_FOUND).json({ message: 'Report folder not found' });
      return;
    }

    const cleanPath = decodeURIComponent(rawPath.split('?')[0]).replace(/^\/+/, '');
    const filePath = path.resolve(reportRootDir, cleanPath);

    if (!isPathInside(filePath, reportRootDir)) {
      res.status(StatusCodes.BAD_REQUEST).json({ message: 'Access denied: File outside report scope' });
      return;
    }

    const stat = await fs.promises.stat(filePath).catch(() => null);
    if (!stat || !stat.isFile()) {
      res.status(StatusCodes.NOT_FOUND).json({ message: 'File not found' });
      return;
    }

    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    res.sendFile(filePath);
  } catch (error) {
    next(error);
  }
};
