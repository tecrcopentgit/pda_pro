const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());

// Serve uploaded PDFs statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// PostgreSQL connection
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'pda_medication_db',
  password: 'haadhi015',
  port: 5432
});

// Ensure uploads folder exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Only PDFs are allowed'));
  }
});

// Create reports table if not exists
const createTable = async () => {
  const query = `
    CREATE TABLE IF NOT EXISTS reports (
      id SERIAL PRIMARY KEY,
      user_id INT,
      report_name VARCHAR(255) NOT NULL,
      doctor_name VARCHAR(255) NOT NULL,
      report_date DATE NOT NULL,
      lab_name VARCHAR(255) NOT NULL,
      pdf_path VARCHAR(255)
    );
  `;
  try {
    await pool.query(query);
    console.log('Table "reports" is ready.');
  } catch (err) {
    console.error('Error creating reports table:', err);
  }
};
createTable();

// Authentication middleware (placeholder)
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

// ---- Routes ----

// CREATE report (with optional PDF)
app.post('/reports', authenticate, upload.single('report_pdf'), async (req, res) => {
  try {
    console.log('Body:', req.body);
    console.log('File:', req.file);

    const { user_id, report_name, doctor_name, report_date, lab_name } = req.body;
    const pdf_path = req.file ? req.file.path : null;

    const result = await pool.query(
      `INSERT INTO reports 
       (user_id, report_name, doctor_name, report_date, lab_name, pdf_path) 
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [user_id, report_name, doctor_name, report_date, lab_name, pdf_path]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error creating report:', err);
    res.status(500).json({ error: 'Failed to create report' });
  }
});

// READ reports for a user
app.get('/reports/user/:user_id', authenticate, async (req, res) => {
  try {
    const { user_id } = req.params;
    const result = await pool.query(
      'SELECT * FROM reports WHERE user_id=$1 ORDER BY id DESC',
      [user_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching reports:', err);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

// DELETE a report by ID (removes PDF too)
app.delete('/reports/:id/user/:user_id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    // Get PDF path
    const report = await pool.query('SELECT pdf_path FROM reports WHERE id=$1', [id]);
    const pdf_path = report.rows[0]?.pdf_path;
    if (pdf_path && fs.existsSync(pdf_path)) {
      fs.unlinkSync(pdf_path); // delete PDF
    }

    await pool.query('DELETE FROM reports WHERE id=$1', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting report:', err);
    res.status(500).json({ error: 'Failed to delete report' });
  }
});

// Start server
const PORT = 2999;
app.listen(PORT, () => {
  console.log(`Reports server running on http://localhost:${PORT}`);
});
