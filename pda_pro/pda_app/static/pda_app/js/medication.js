const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const { Client } = require("pg");

const app = express();
app.use(cors());
app.use(express.json());
app.use(bodyParser.json());

// PostgreSQL connection
const client = new Client({
  user: "postgres",
  host: "localhost",
  database: "pda_medication_db",
  password: "haadhi015",  // change if needed
  port: 5432,
});

client.connect()
  .then(() => console.log("✅ Connected to PostgreSQL"))
  .catch(err => console.error("❌ Connection error:", err));

// ---- Ensure table exists ----
async function ensureTable() {
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
}
ensureTable();

// ---- Routes ----

// ✅ Get medications for a specific user
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

// ✅ Insert medication for a user
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

// ✅ Delete medication only if it belongs to the user
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

// ✅ Count medications for a user
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

// ---- Start server ----
const PORT = 3001;
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  console.log(`   ➜ GET   http://localhost:${PORT}/medications/:user_id`);
  console.log(`   ➜ POST  http://localhost:${PORT}/add-medication`);
  console.log(`   ➜ DELETE http://localhost:${PORT}/delete-medication/:id/:user_id`);
  console.log(`   ➜ GET   http://localhost:${PORT}/medications-count/:user_id`);
});
