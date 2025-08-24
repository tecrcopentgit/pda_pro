const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// PostgreSQL connection
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'pda_medication_db', // change to your DB
  password: 'haadhi015',
  port: 5432
});

// Create table if not exists
const createTable = async () => {
  const query = `
    CREATE TABLE IF NOT EXISTS tests (
      id SERIAL PRIMARY KEY,
      user_id INT,
      test_name VARCHAR(255) NOT NULL,
      doctor_name VARCHAR(255) NOT NULL,
      test_for_person VARCHAR(255) NOT NULL,
      date DATE NOT NULL,
      lab_name VARCHAR(255) NOT NULL
    );
  `;
  try {
    await pool.query(query);
    console.log('Table "tests" is ready.');
  } catch (err) {
    console.error('Error creating table:', err);
  }
};

// Call createTable on startup
createTable();

// Middleware for token check (optional)
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });
  // If you implement JWT, verify here
  next();
}

// CREATE a test
app.post('/tests', authenticate, async (req, res) => {
  try {
    const { user_id, test_name, doctor_name, test_for_person, date, lab_name } = req.body;
    const result = await pool.query(
      'INSERT INTO tests (user_id, test_name, doctor_name, test_for_person, date, lab_name) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [user_id, test_name, doctor_name, test_for_person, date, lab_name]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create test' });
  }
});

// READ all tests for a user
app.get('/tests/user/:user_id', authenticate, async (req, res) => {
  try {
    const { user_id } = req.params;
    const result = await pool.query('SELECT * FROM tests WHERE user_id=$1 ORDER BY id DESC', [user_id]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch tests' });
  }
});

// DELETE a test by ID
app.delete('/tests/:id/user/:user_id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM tests WHERE id=$1', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete test' });
  }
});

// Start server
const PORT = 2998;
app.listen(PORT, () => {
  console.log(`Tests server running on http://localhost:${PORT}`);
});
