const express = require('express');
const { query } = require('../db/pool');

const router = express.Router();

// Join in teacher name for convenient display on the frontend.
const SELECT_WITH_TEACHER = `
  SELECT c.*, t.first_name AS teacher_first_name, t.last_name AS teacher_last_name
  FROM classes c
  LEFT JOIN teachers t ON t.id = c.teacher_id
`;

router.get('/', async (req, res) => {
  try {
    const result = await query(`${SELECT_WITH_TEACHER} ORDER BY c.name`);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch classes' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await query(`${SELECT_WITH_TEACHER} WHERE c.id = $1`, [
      req.params.id,
    ]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Class not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch class' });
  }
});

router.post('/', async (req, res) => {
  const { name, grade_level, room, teacher_id } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'name is required' });
  }

  try {
    const result = await query(
      `INSERT INTO classes (name, grade_level, room, teacher_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [name, grade_level || null, room || null, teacher_id || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create class' });
  }
});

router.put('/:id', async (req, res) => {
  const { name, grade_level, room, teacher_id } = req.body;

  try {
    const result = await query(
      `UPDATE classes SET
        name = COALESCE($1, name),
        grade_level = COALESCE($2, grade_level),
        room = COALESCE($3, room),
        teacher_id = COALESCE($4, teacher_id)
       WHERE id = $5
       RETURNING *`,
      [name, grade_level, room, teacher_id, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Class not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update class' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const result = await query(
      'DELETE FROM classes WHERE id = $1 RETURNING id',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Class not found' });
    }
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete class' });
  }
});

// GET /api/classes/:id/students - students enrolled in this class
router.get('/:id/students', async (req, res) => {
  try {
    const result = await query(
      `SELECT s.* FROM students s
       JOIN enrollments e ON e.student_id = s.id
       WHERE e.class_id = $1
       ORDER BY s.last_name, s.first_name`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch class roster' });
  }
});

module.exports = router;
