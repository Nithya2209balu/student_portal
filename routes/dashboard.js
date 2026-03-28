const express = require("express");
const router = express.Router();
const { 
    getDashboardCounts, 
    getDashboardCountsById, 
    getAdminAttendanceDashboard,
    getUnifiedUserDashboard,
    getUnifiedAdminDashboard
} = require("../controllers/dashboardController");
const { protect, isAdmin } = require("../middlewares/auth");

// Unified Dashboards
router.get("/overall/:userId", protect, getUnifiedUserDashboard);
router.get("/admin/overall", protect, isAdmin, getUnifiedAdminDashboard);

// Admin overall student dashboard
router.get("/admin/attendance", protect, isAdmin, getAdminAttendanceDashboard);

// Without ID – uses the logged-in student's JWT token
router.get("/counts", protect, getDashboardCounts);

// With ID – fetches dashboard for any student by their _id
router.get("/counts/:userId", protect, getDashboardCountsById);

module.exports = router;
