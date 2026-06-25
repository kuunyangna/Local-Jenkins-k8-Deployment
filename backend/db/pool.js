const { Pool } = require('pg');

// All values come from environment variables so the same image can be
// reused across environments just by changing the ConfigMap/Secret you
// mount into the Deployment.
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'school_db',
  user: process.env.DB_USER || 'school_user',
  password: process.env.DB_PASSWORD || 'school_pass',
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('Unexpected Postgres pool error', err);
});

async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  if (process.env.NODE_ENV !== 'production') {
    console.log('executed query', { text, duration, rows: res.rowCount });
  }
  return res;
}

module.exports = { pool, query };
