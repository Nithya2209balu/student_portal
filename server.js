require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const { initFirebase } = require("./config/firebase");
const errorHandler = require("./middlewares/errorHandler");

// ── Init ──────────────────────────────────────────────────────────────────────
connectDB();
initFirebase();

const app = express();

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/api/auth", require("./routes/auth"));
app.use("/api/dashboard", require("./routes/dashboard"));
app.use("/api/notifications", require("./routes/notifications"));
app.use("/api/enrollments", require("./routes/enrollments"));
app.use("/api/leaderboard", require("./routes/leaderboard"));
app.use("/api/courses", require("./routes/courses"));
app.use("/api/attendance", require("./routes/attendance"));

// ── Health Check ──────────────────────────────────────────────────────────────
app.get("/", (req, res) => {
    res.json({ success: true, message: "Student Portal API is running 🚀" });
});

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((req, res) => {
    res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

// ── Global Error Handler ──────────────────────────────────────────────────────
app.use(errorHandler);

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
