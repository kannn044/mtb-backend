import fs from 'fs';
import csv from 'csv-parser';

export type ParsedMetadata = {
  delimiter: ',' | '\t';
  rows: Record<string, string>[];
};

const detectDelimiter = async (filePath: string): Promise<',' | '\t'> => {
  const stream = fs.createReadStream(filePath, { encoding: 'utf8' });

  return await new Promise((resolve, reject) => {
    let buffer = '';

    stream.on('data', (chunk: string) => {
      buffer += chunk;
      const idx = buffer.indexOf('\n');
      if (idx !== -1) {
        stream.destroy();
        const firstLine = buffer.slice(0, idx).trim();
        // Heuristic: if the header contains tabs, treat as TSV; otherwise CSV.
        resolve(firstLine.includes('\t') ? '\t' : ',');
      }
    });

    stream.on('error', reject);
    stream.on('close', () => {
      if (buffer.trim().length > 0) {
        const firstLine = buffer.trim().split(/\r?\n/)[0];
        resolve(firstLine.includes('\t') ? '\t' : ',');
      }
    });
  });
};

export const parseMetadataFile = async (filePath: string): Promise<ParsedMetadata> => {
  const delimiter = await detectDelimiter(filePath);

  const rows = await new Promise<Record<string, string>[]>((resolve, reject) => {
    const results: Record<string, string>[] = [];

    fs.createReadStream(filePath)
      .pipe(
        csv({
          separator: delimiter,
          mapValues: ({ value }) => (typeof value === 'string' ? value.trim() : String(value)),
        })
      )
      .on('data', (data) => {
        const row: Record<string, string> = {};
        for (const [k, v] of Object.entries(data)) {
          row[String(k).trim()] = typeof v === 'string' ? v.trim() : String(v);
        }
        results.push(row);
      })
      .on('end', () => resolve(results))
      .on('error', reject);
  });

  return { delimiter, rows };
};
