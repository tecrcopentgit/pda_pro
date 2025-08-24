const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const { Client } = require("pg");

const app = express();
app.use(cors());
app.use(express.json());
app.use(bodyParser.json());

const client = new Client({
  user: "postgres",
  host: "localhost",
  database: "pda_medication_db",
  password: "haadhi015",
  port: 5432,
});

client.connect()
  .then(() => console.log("Connected to DB"))
  .catch(err => console.error("Connection error:", err));

async function ensureTable() {
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
}
ensureTable();

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

const PORT = 3022;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
