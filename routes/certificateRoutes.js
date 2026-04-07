const express = require("express");
const router = express.Router();
const certificateController = require("../controllers/certificateController");
const { protect } = require("../middlewares/auth");

// ── Dashboard ───────────────────────────────────────────────────────
// Admin: Get stats for the dashboard
router.get("/dashboard", certificateController.getDashboardStats);

// ── Requests ────────────────────────────────────────────────────────
// Student: Create a new certificate request
router.post("/requests", protect, certificateController.requestCertificate);
// Admin: View all request (supports ?status=Pending)
router.get("/requests", certificateController.getRequests);

// ── Certificates ────────────────────────────────────────────────────
// Admin: Generate a new certificate and linked PDF
router.post("/generate", certificateController.createCertificate);
// Student: Get their certificates
router.get("/user/:userId", certificateController.getCertificate);
// Student: Download secure PDF
router.get("/download/:certId", protect, certificateController.downloadCertificate);

module.exports = router;
