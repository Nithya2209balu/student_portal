const express = require("express");
const router = express.Router();
const { updateFCMToken } = require("../controllers/authController");

// Public route to update FCM token (uses email/password verification)
router.put("/update-fcm-token", updateFCMToken);

module.exports = router;
