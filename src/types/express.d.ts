import { Knex } from 'knex';

declare global {
  namespace Express {
    interface Request {
      db: Knex; // บอกว่า req.db คือตัว Knex Instance นะ
      decoded: any;
    }
  }
}