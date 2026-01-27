import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import { resolveLatestPreexistingMetadata } from '../utils/preexistingDb';
import { parseMetadataFile } from '../utils/metadataFile';

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
