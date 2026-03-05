const express = require("express");
const router = express.Router();
const {
    getAttendanceSummary,
    getAttendanceList,
} = require("../controllers/attendanceController");
const { protect } = require("../middlewares/auth");

router.get("/summary", protect, getAttendanceSummary);
router.get("/", protect, getAttendanceList);

module.exports = router;
