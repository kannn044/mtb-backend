import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';

export const getCsvData = async (req: Request, res: Response) => {
  const results: any[] = [];
  const csvFilePath = path.join(__dirname, '..', '..', '..', 'mtb-backend', 'public', 'data.csv');

  fs.createReadStream(csvFilePath)
    .pipe(csv())
    .on('data', (data) => results.push(data))
    .on('end', () => {
      res.status(StatusCodes.OK).json(results);
    })
    .on('error', (error) => {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
    });
};
