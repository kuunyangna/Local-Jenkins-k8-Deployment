const fs = require('fs');
const path = require('path');
const { pool } = require('./pool');

// Runs schema.sql on startup. Using CREATE TABLE IF NOT EXISTS in the
// schema makes this safe to run every time the pod starts, including
// on rolling restarts and multiple replicas.
async function initSchema() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');

  let attempts = 0;
  const maxAttempts = 10;
  const delayMs = 3000;

  while (attempts < maxAttempts) {
    try {
      await pool.query(sql);
      console.log('Database schema is ready');
      return;
    } catch (err) {
      attempts += 1;
      console.error(
        `Schema init failed (attempt ${attempts}/${maxAttempts}): ${err.message}`
      );
      if (attempts >= maxAttempts) {
        throw err;
      }
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

module.exports = { initSchema };
