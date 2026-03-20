const express = require("express");
const router = express.Router();
const { createLeave, getLeaves } = require("../controllers/leaveController");
const { protect } = require("../middlewares/auth");

router.post("/", protect, createLeave);   // POST /api/leave
router.get("/", protect, getLeaves);      // GET  /api/leave  (+ query filters)

module.exports = router;
