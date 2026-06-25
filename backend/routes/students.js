const express = require('express');
const { query } = require('../db/pool');

const router = express.Router();

// GET /api/students - list all students
router.get('/', async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM students ORDER BY last_name, first_name'
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch students' });
  }
});

// GET /api/students/:id - get a single student
router.get('/:id', async (req, res) => {
  try {
    const result = await query('SELECT * FROM students WHERE id = $1', [
      req.params.id,
    ]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch student' });
  }
});

// POST /api/students - create a student
router.post('/', async (req, res) => {
  const {
    first_name,
    last_name,
    email,
    date_of_birth,
    guardian_name,
    guardian_phone,
  } = req.body;

  if (!first_name || !last_name || !email) {
    return res
      .status(400)
      .json({ error: 'first_name, last_name and email are required' });
  }

  try {
    const result = await query(
      `INSERT INTO students
        (first_name, last_name, email, date_of_birth, guardian_name, guardian_phone)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        first_name,
        last_name,
        email,
        date_of_birth || null,
        guardian_name || null,
        guardian_phone || null,
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Email already in use' });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to create student' });
  }
});

// PUT /api/students/:id - update a student
router.put('/:id', async (req, res) => {
  const {
    first_name,
    last_name,
    email,
    date_of_birth,
    guardian_name,
    guardian_phone,
  } = req.body;

  try {
    const result = await query(
      `UPDATE students SET
        first_name = COALESCE($1, first_name),
        last_name = COALESCE($2, last_name),
        email = COALESCE($3, email),
        date_of_birth = COALESCE($4, date_of_birth),
        guardian_name = COALESCE($5, guardian_name),
        guardian_phone = COALESCE($6, guardian_phone)
       WHERE id = $7
       RETURNING *`,
      [
        first_name,
        last_name,
        email,
        date_of_birth,
        guardian_name,
        guardian_phone,
        req.params.id,
      ]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update student' });
  }
});

// DELETE /api/students/:id - delete a student
router.delete('/:id', async (req, res) => {
  try {
    const result = await query(
      'DELETE FROM students WHERE id = $1 RETURNING id',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete student' });
  }
});

module.exports = router;
