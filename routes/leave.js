const express = require("express");
const router = express.Router();
const {
    createLeave,
    getAllLeaves,
    getLeavesByUser,
    updateLeaveStatus,
} = require("../controllers/leaveController");
const { protect, isAdmin } = require("../middlewares/auth");

// ── User Routes ───────────────────────────────────────────────────────────────
router.post("/", protect, createLeave);                 // POST /api/leave

// ── Admin Routes ──────────────────────────────────────────────────────────────
router.get("/", protect, isAdmin, getAllLeaves);         // GET  /api/leave  (all | ?status=pending/approved/rejected)
router.put("/:leaveId/status", protect, isAdmin, updateLeaveStatus); // PUT  /api/leave/:leaveId/status

// ── User-Specific Routes ──────────────────────────────────────────────────────
router.get("/:userId", protect, getLeavesByUser);       // GET  /api/leave/:userId  (+ date/month filters)

module.exports = router;
