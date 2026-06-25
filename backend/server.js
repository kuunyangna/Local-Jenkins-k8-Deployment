require('dotenv').config();
const express = require('express');
const cors = require('cors');

const { pool } = require('./db/pool');
const { initSchema } = require('./db/init');

const studentsRouter = require('./routes/students');
const teachersRouter = require('./routes/teachers');
const classesRouter = require('./routes/classes');
const enrollmentsRouter = require('./routes/enrollments');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());

// Simple request log - handy for `kubectl logs` while you're testing
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.originalUrl}`);
  next();
});

// --- API routes ---
// Everything lives under /api so your Ingress can route by path prefix,
// e.g. path "/api" -> backend-service:3000, path "/" -> frontend-service:80
const api = express.Router();

api.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'school-app-backend' });
});

api.get('/ready', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ready' });
  } catch (err) {
    res.status(503).json({ status: 'not-ready', error: err.message });
  }
});

api.use('/students', studentsRouter);
api.use('/teachers', teachersRouter);
api.use('/classes', classesRouter);
api.use('/enrollments', enrollmentsRouter);

app.use('/api', api);

// 404 fallback for anything else under /api
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.get('/', (req, res) => {
  res.json({ service: 'school-app-backend', status: 'running' });
});

async function start() {
  try {
    await initSchema();
  } catch (err) {
    console.error('Could not initialize database schema, exiting.', err);
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`School app backend listening on port ${PORT}`);
  });
}

start();

// Graceful shutdown for clean pod restarts/rollouts
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing server...');
  await pool.end();
  process.exit(0);
});
