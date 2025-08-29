// server.js - Merged from 5 separate Node.js services
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const {Client } = require('pg');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();

// ============== MIDDLEWARE ==============
const allowedOrigins = [
  'https://pda-med-api.onrender.com',
  'http://localhost:3000',
  'http:// localhost:8000',
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json());
app.use(bodyParser.json());

// Serve uploaded PDFs statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
console.log('connecting to db');

// ============== DATABASE CONNECTIONS ==============
// PostgreSQL Client for users (changed from pool to client)
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' 
    ? { rejectUnauthorized: false }  // ✅ For Render/production
    : false                          // ✅ For localhost
});

client.connect()
  .then(() => console.log("✅ Connected to PostgreSQL"))
  .catch(err => console.error("❌ Connection error:", err.message));

// ============== FILE UPLOAD SETUP ==============
// Ensure uploads folder exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// Multer setup for PDF uploads
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

// ============== DATABASE TABLE CREATION ==============
// Create users table
const createUsersTable = async () => {
  const query = `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL
    );
  `;
  try {
    await client.query(query);
    console.log('✅ Users table is ready');
  } catch (err) {
    console.error('Error creating users table:', err.message);
  }
};

// Create medications table
const createMedicationsTable = async () => {
  await client.query(`
    CREATE TABLE IF NOT EXISTS medications (
      id SERIAL PRIMARY KEY,
      user_id INT NOT NULL,
      name TEXT,
      dosage TEXT,
      frequency TEXT,
      route TEXT,
      value INT
    );
  `);
  console.log('✅ Medications table is ready');
};

// Create remainder table
const createRemainderTable = async () => {
  await client.query(`
    CREATE TABLE IF NOT EXISTS remainder (
      id SERIAL PRIMARY KEY,
      user_id INT NOT NULL,
      med_name TEXT NOT NULL,
      dosage TEXT NOT NULL,
      med_type TEXT NOT NULL,
      med_time TIME NOT NULL
    );
  `);
  console.log('✅ Remainder table is ready');
};

// Create reports table
const createReportsTable = async () => {
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
    await client.query(query);
    console.log('✅ Reports table is ready');
  } catch (err) {
    console.error('Error creating reports table:', err.message);
  }
};

// Initialize all tables
const initializeTables = async () => {
  await createUsersTable();
  await createMedicationsTable();
  await createRemainderTable();
  await createReportsTable();
};
initializeTables();

// ============== JWT MIDDLEWARE ==============
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Missing token' });

  jwt.verify(token, process.env.JWT_SECRET || 'default_secret_key', (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
}

// Basic auth middleware for reports (placeholder)
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

// ============== AUTHENTICATION ROUTES (from register.js) ==============
// Register
app.post('/register', async (req, res) => {
  const { username, email, password } = req.body;
  try {
    const hashed = await bcrypt.hash(password, 10);
    await client.query(
      'INSERT INTO users (username, email, password) VALUES ($1, $2, $3)',
      [username, email, hashed]
    );
    res.status(201).json({ message: 'Registered successfully' });
  } catch (err) {
    res.status(400).json({ error: 'Registration failed', details: err.message });
  }
});

// Login
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await client.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];

    if (!user || !(await bcrypt.compare(password, user.password))) {
      res.status(401).json({ error: 'Invalid credentials' });
    }

    res.json({ message: 'Login successful' });

    const token = jwt.sign(
      { userId: user.id, email: user.email, username: user.username },
      process.env.JWT_SECRET || 'default_secret_key',
      { expiresIn: '1h' }
    );

    res.json({ token });
  } catch (err) {
    res.status(500).json({ error: 'Login failed', details: err.message });
  }
});

// Profile (protected)
app.get('/profile', authenticateToken, async (req, res) => {
  try {
    const result = await client.query(
      'SELECT username, email FROM users WHERE id = $1',
      [req.user.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch profile', details: err.message });
  }
});

// ============== MEDICATIONS ROUTES (from medication.js) ==============
// Get medications for a specific user
app.get("/medications/:user_id", async (req, res) => {
  const { user_id } = req.params;
  try {
    const result = await client.query(
      "SELECT * FROM medications WHERE user_id = $1 ORDER BY id ASC",
      [user_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Fetch error:", err.message);
    res.status(500).json({ error: "Database error" });
  }
});

// Insert medication for a user
app.post("/add-medication", async (req, res) => {
  const { user_id, name, dosage, frequency, route, value } = req.body;
  if (!user_id) {
    return res.status(400).json({ error: "Missing user_id" });
  }

  try {
    await client.query(
      "INSERT INTO medications (user_id, name, dosage, frequency, route, value) VALUES ($1, $2, $3, $4, $5, $6)",
      [user_id, name, dosage, frequency, route, value]
    );
    res.json({ message: "✅ Medication added successfully" });
  } catch (err) {
    console.error("❌ Insert error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Delete medication only if it belongs to the user
app.delete("/delete-medication/:id/:user_id", async (req, res) => {
  const { id, user_id } = req.params;
  try {
    const result = await client.query(
      "DELETE FROM medications WHERE id = $1 AND user_id = $2",
      [id, user_id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Medication not found or not yours" });
    }
    res.json({ message: `✅ Medication with ID ${id} deleted` });
  } catch (err) {
    console.error("❌ Delete error:", err.message);
    res.status(500).json({ error: "Database error" });
  }
});

// Count medications for a user
app.get("/medications-count/:user_id", async (req, res) => {
  const { user_id } = req.params;
  try {
    const result = await client.query(
      "SELECT COUNT(*) FROM medications WHERE user_id = $1",
      [user_id]
    );
    const count = parseInt(result.rows[0].count, 10);
    res.json({ count });
  } catch (err) {
    console.error("❌ Count error:", err.message);
    res.status(500).json({ error: "Database error" });
  }
});

// ============== REMAINDER ROUTES (from remainder.js) ==============
// Get reminders for a specific user
app.get("/remainder/:user_id", async (req, res) => {
  const { user_id } = req.params;
  try {
    const result = await client.query(
      "SELECT * FROM remainder WHERE user_id = $1 ORDER BY id ASC",
      [user_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.log("Fetch error:", err.message);
    res.status(500).json({ error: "Database error" });
  }
});

// Add remainder for a user
app.post("/add-remainder", async (req, res) => {
  const { user_id, med_name, dosage, med_type, med_time } = req.body;
  if (!user_id) {
    return res.status(400).json({ error: "Missing user_id" });
  }

  try {
    await client.query(
      "INSERT INTO remainder (user_id, med_name, dosage, med_type, med_time) VALUES ($1, $2, $3, $4, $5)",
      [user_id, med_name, dosage, med_type, med_time]
    );
    res.json({ message: "Reminder added" });
  } catch (err) {
    console.log("Insert error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Delete remainder only if it belongs to the user
app.delete("/delete-remainder/:id/:user_id", async (req, res) => {
  const { id, user_id } = req.params;
  try {
    const result = await client.query(
      "DELETE FROM remainder WHERE id = $1 AND user_id = $2",
      [id, user_id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Reminder not found" });
    }
    res.json({ message: `Reminder with ID ${id} deleted` });
  } catch (err) {
    console.error("Delete error:", err.message);
    res.status(500).json({ error: "Database error" });
  }
});

// Count reminders for a user
app.get("/remainder-count/:user_id", async (req, res) => {
  const { user_id } = req.params;
  try {
    const result = await client.query(
      "SELECT COUNT(*) FROM remainder WHERE user_id = $1",
      [user_id]
    );
    const count = parseInt(result.rows[0].count, 10);
    res.json({ count });
  } catch (err) {
    console.error("Count error:", err.message);
    res.status(500).json({ error: "Database error" });
  }
});

// ============== REPORTS ROUTES (from report.js) ==============
// CREATE report (with optional PDF)
app.post('/reports', authenticate, upload.single('report_pdf'), async (req, res) => {
  try {
    console.log('Body:', req.body);
    console.log('File:', req.file);

    const { user_id, report_name, doctor_name, report_date, lab_name } = req.body;
    const pdf_path = req.file ? req.file.path : null;

    const result = await client.query(
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
    const result = await client.query(
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
    const report = await client.query('SELECT pdf_path FROM reports WHERE id=$1', [id]);
    const pdf_path = report.rows[0]?.pdf_path;
    if (pdf_path && fs.existsSync(pdf_path)) {
      fs.unlinkSync(pdf_path); // delete PDF
    }

    await client.query('DELETE FROM reports WHERE id=$1', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting report:', err);
    res.status(500).json({ error: 'Failed to delete report' });
  }
});

// ============== TEST ROUTE ==============
app.get('/test', (req, res) => {
  res.json({ 
    message: 'Unified server is working!', 
    services: ['Auth', 'Medications', 'Reminders', 'Reports'],
    timestamp: new Date().toISOString()
  });
});

// ============== HEALTH CHECK ==============
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// ============== START SERVER ==============
const PORT = process.env.PORT || 3000;
app.listen(PORT,'0.0.0.0', () => {
  console.log(`\n🚀 Unified Server running at ${PORT}`);
  console.log('\n📋 Available Endpoints:');
  console.log('   ➜ Authentication:');
  console.log('     POST   /register');
  console.log('     POST   /login');
  console.log('     GET    /profile (protected)');
  console.log('   ➜ Medications:');
  console.log('     GET    /medications/:user_id');
  console.log('     POST   /add-medication');
  console.log('     DELETE /delete-medication/:id/:user_id');
  console.log('     GET    /medications-count/:user_id');
  console.log('   ➜ Reminders:');
  console.log('     GET    /remainder/:user_id');
  console.log('     POST   /add-remainder');
  console.log('     DELETE /delete-remainder/:id/:user_id');
  console.log('     GET    /remainder-count/:user_id');
  console.log('   ➜ Reports:');
  console.log('     POST   /reports (with PDF upload)');
  console.log('     GET    /reports/user/:user_id');
  console.log('     DELETE /reports/:id/user/:user_id');
  console.log('   ➜ Utilities:');
  console.log('     GET    /test');
  console.log('     GET    /health');
  console.log(`\n✨ All services merged successfully on port ${PORT}!`);
});

// ============== GRACEFUL SHUTDOWN ==============
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down server...');
  try {
    await client.end();
    console.log('✅ Database connection closed');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error during shutdown:', err);
    process.exit(1);
  }
});