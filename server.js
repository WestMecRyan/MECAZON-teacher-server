const express = require("express");
const cors = require("cors");
const app = express();
const PORT = 3000;

// Middleware
app.use(cors());

// Routes

app.get("/dummy-data/groceries", (req, res) => {
  const groceries = require("./dummy-data/groceries.json");
  res.json(groceries);
});

app.get("/api/groceries", (req, res) => {
  const groceries = require("./db/groceries.json");
  res.json(groceries);
});

app.get("/api/employees", (req, res) => {
  const employees = require("./db/employees.json");
  res.json(employees);
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
