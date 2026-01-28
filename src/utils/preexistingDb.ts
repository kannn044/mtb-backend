import fs from 'fs';
import path from 'path';

export type PreexistingDbVersion = {
  dirName: string; // e.g. v20260115.02
  date: string; // YYYYMMDD
  revision: number; // xx
  baseDir: string; // <DIR_PATH>/preexisting_db(s)
  versionDir: string; // full path
  metadataPath: string; // full path to metadata.txt
};

// Supports vYYYYMMDD.xx and vYYYYMMDD.x (e.g. v20260124.1)
const VERSION_RE = /^v(\d{8})\.(\d{1,2})$/;

const parseVersionDir = (dirName: string): { date: string; revision: number } | null => {
  const m = VERSION_RE.exec(dirName);
  if (!m) return null;
  return { date: m[1], revision: Number(m[2]) };
};

const compareVersions = (a: { date: string; revision: number }, b: { date: string; revision: number }): number => {
  if (a.date !== b.date) return a.date.localeCompare(b.date);
  return a.revision - b.revision;
};

/**
 * Resolve the latest `preexisting_db/vYYYYMMDD.xx` folder and its `metadata.txt`.
 *
 * Uses `<DIR_PATH>/preexisting_db(s)` as base.
 */
export const resolveLatestPreexistingMetadata = (dirPath: string): PreexistingDbVersion => {
  const trimmed = dirPath?.trim();
  if (!trimmed) throw new Error('Missing DIR_PATH');

  const baseDir = path.resolve(trimmed, 'preexisting_dbs');
  if (!fs.existsSync(baseDir) || !fs.statSync(baseDir).isDirectory()) {
    throw new Error(`preexisting_dbs not found at ${baseDir}`);
  }

  const entries = fs.readdirSync(baseDir, { withFileTypes: true });
  const versions = entries
    .filter(e => e.isDirectory())
    .map(e => ({ dirName: e.name, parsed: parseVersionDir(e.name) }))
    .filter((v): v is { dirName: string; parsed: { date: string; revision: number } } => Boolean(v.parsed));

  if (versions.length === 0) {
    throw new Error(`No version folders found in ${baseDir} (expected vYYYYMMDD.xx or vYYYYMMDD.x)`);
  }

  versions.sort((a, b) => compareVersions(a.parsed, b.parsed));
  const latest = versions[versions.length - 1];

  const versionDir = path.join(baseDir, latest.dirName);

  // New layout: <versionDir>/metadata/metadata.txt
  const nestedMetadataPath = path.join(versionDir, 'metadata', 'metadata.txt');
  // Backward-compatible layout: <versionDir>/metadata.txt
  const rootMetadataPath = path.join(versionDir, 'metadata.txt');

  const metadataPath = fs.existsSync(nestedMetadataPath)
    ? nestedMetadataPath
    : rootMetadataPath;

  if (!fs.existsSync(metadataPath) || !fs.statSync(metadataPath).isFile()) {
    throw new Error(
      `metadata.txt not found at ${nestedMetadataPath} (or fallback ${rootMetadataPath})`
    );
  }

  return {
    dirName: latest.dirName,
    date: latest.parsed.date,
    revision: latest.parsed.revision,
    baseDir,
    versionDir,
    metadataPath,
  };
};
