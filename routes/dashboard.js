const express = require("express");
const router = express.Router();
const { getDashboardCounts } = require("../controllers/dashboardController");
const { protect } = require("../middlewares/auth");

router.get("/counts", protect, getDashboardCounts);

module.exports = router;
