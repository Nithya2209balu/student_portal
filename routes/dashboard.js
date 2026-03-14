const express = require("express");
const router = express.Router();
const { getDashboardCounts, getDashboardCountsById } = require("../controllers/dashboardController");
const { protect } = require("../middlewares/auth");

// Without ID – uses the logged-in student's JWT token
router.get("/counts", protect, getDashboardCounts);

// With ID – fetches dashboard for any student by their _id
router.get("/counts/:userId", protect, getDashboardCountsById);

module.exports = router;
