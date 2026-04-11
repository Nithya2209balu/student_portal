const express = require("express");
const router = express.Router();
const { createAdmission } = require("../controllers/admissionController");

// POST /api/admissions
router.post("/", createAdmission);

module.exports = router;
