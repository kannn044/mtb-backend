import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';

import multer from 'multer';
import cors from 'cors';
import { knex } from 'knex';

// const storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     cb(null, 'uploads/'); // อย่าลืมสร้างโฟลเดอร์ uploads ในโปรเจกต์
//   },
//   filename: (req, file, cb) => {
//     const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
//     cb(null, uniqueSuffix + path.extname(file.originalname));
//   }
// });

// const upload = multer({ storage: storage });

export const uploadFile =  async (req: Request, res: Response) => {
  try {
    const { title, description } = req.body;
    const file = req.file;

    console.log('File:', file);
    console.log('Title:', title);
    console.log('Description:', description);

    // if (!file) {
    //   return res.status(400).json({ message: 'No file uploaded' });
    // }

    // บันทึกลง Database ด้วย Knex
    // สมมติว่ามีตารางชื่อ files
    /*
    await db('files').insert({
      title: title,
      description: description,
      file_path: file.path,
      original_name: file.originalname,
      created_at: new Date()
    });
    */

    // console.log('Saved Metadata:', { title, description });
    // console.log('Saved File:', file.path);

    // res.status(200).json({ message: 'Upload success' });
    return 'test';
  } catch (error) {
    // const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    // res.status(500).json({ error: errorMessage });
    return error;
  }
};
  