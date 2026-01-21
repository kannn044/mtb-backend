// knexfile.ts
import type { Knex } from "knex";
import dotenv from "dotenv";
import fs from 'fs';

dotenv.config();

const parseBoolean = (val: string | undefined): boolean | undefined => {
  if (val === undefined) return undefined;
  const normalized = val.trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) return false;
  return undefined;
};

const readCaFromEnv = (): string | undefined => {
  const caInline = process.env.DB_SSL_CA?.trim();
  if (caInline) return caInline.replace(/\\n/g, '\n');
  const caFilePath = process.env.DB_SSL_CA_FILE?.trim();
  if (!caFilePath) return undefined;
  try {
    return fs.readFileSync(caFilePath, 'utf8');
  } catch {
    return undefined;
  }
};

const dbHost = process.env.DB_HOST || 'localhost';
const isTiDBCloud = dbHost.includes('tidbcloud.com');
const dbPort = Number(process.env.DB_PORT) || (isTiDBCloud ? 4000 : 3306);
const enableSsl = parseBoolean(process.env.DB_SSL) ?? isTiDBCloud;
const rejectUnauthorized = parseBoolean(process.env.DB_SSL_REJECT_UNAUTHORIZED) ?? true;
const sslCa = readCaFromEnv();
const ssl = enableSsl
  ? {
      minVersion: 'TLSv1.2',
      rejectUnauthorized,
      ...(sslCa ? { ca: sslCa } : {}),
    }
  : undefined;

const config: Knex.Config = {
  client: "mysql2",
  connection: {
    host: dbHost,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: dbPort,
    ...(ssl ? { ssl } : {})
  },
  migrations: {
    directory: "./src/database/migrations",
    extension: "ts"
  },
  seeds: {
    directory: "./src/database/seeds",
    extension: "ts"
  }
};

export default config;