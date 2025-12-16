// knexfile.ts
import type { Knex } from "knex";
import dotenv from "dotenv";

dotenv.config();

const config: Knex.Config = {
  client: "mysql2",
  connection: {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
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