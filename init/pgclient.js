import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const Pool = pg.Pool;

const pool = new Pool({
    user: process.env.POSTGRES_USER,
    host: process.env.POSTGRES_HOST,
    database: process.env.POSTGRES_DB,
    password: process.env.POSTGRES_PASS,
    port: process.env.POSTGRES_PORT,
  })

  pool.connect(function (err) {
    if (err) throw err;
    console.log("Connected to postgress!");
});

export default pool;