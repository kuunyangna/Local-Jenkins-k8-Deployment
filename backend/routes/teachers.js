const express = require('express');
const { query } = require('../db/pool');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM teachers ORDER BY last_name, first_name'
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch teachers' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await query('SELECT * FROM teachers WHERE id = $1', [
      req.params.id,
    ]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Teacher not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch teacher' });
  }
});

router.post('/', async (req, res) => {
  const { first_name, last_name, email, subject, phone } = req.body;

  if (!first_name || !last_name || !email) {
    return res
      .status(400)
      .json({ error: 'first_name, last_name and email are required' });
  }

  try {
    const result = await query(
      `INSERT INTO teachers (first_name, last_name, email, subject, phone)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [first_name, last_name, email, subject || null, phone || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Email already in use' });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to create teacher' });
  }
});

router.put('/:id', async (req, res) => {
  const { first_name, last_name, email, subject, phone } = req.body;

  try {
    const result = await query(
      `UPDATE teachers SET
        first_name = COALESCE($1, first_name),
        last_name = COALESCE($2, last_name),
        email = COALESCE($3, email),
        subject = COALESCE($4, subject),
        phone = COALESCE($5, phone)
       WHERE id = $6
       RETURNING *`,
      [first_name, last_name, email, subject, phone, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Teacher not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update teacher' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const result = await query(
      'DELETE FROM teachers WHERE id = $1 RETURNING id',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Teacher not found' });
    }
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete teacher' });
  }
});

module.exports = router;
