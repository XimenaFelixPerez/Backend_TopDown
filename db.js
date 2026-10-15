import 'dotenv/config';
import sql from 'mssql';

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  options: { trustServerCertificate: true, encrypt: false }
};

export const pool = await new sql.ConnectionPool(config).connect();
export { sql };

console.log("BD conectada:", (await pool.request().query("SELECT DB_NAME() AS db")).recordset[0].db);