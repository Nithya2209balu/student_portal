const express = require("express");
const router = express.Router();
const {
    getAttendanceSummary,
    getAttendanceList,
    getAttendanceSummaryById,
    getAttendanceListById,
} = require("../controllers/attendanceController");
const { protect } = require("../middlewares/auth");

// Without ID – uses logged-in user's JWT token
router.get("/summary", protect, getAttendanceSummary);           // GET /api/attendance/summary
router.get("/", protect, getAttendanceList);                     // GET /api/attendance

// With ID – pass student _id in URL
router.get("/summary/:userId", protect, getAttendanceSummaryById); // GET /api/attendance/summary/:userId
router.get("/:userId", protect, getAttendanceListById);            // GET /api/attendance/:userId

module.exports = router;
