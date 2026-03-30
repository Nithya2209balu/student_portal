const express = require('express');
const router = express.Router();
const { saveToken, getTokens } = require('../db/tokens');
const Notification = require("../models/Notification"); // Kept for DB history
const { getNotifications, getAllNotifications, getNotificationsByUserId } = require("../controllers/notificationController");
const { protect, isAdmin } = require("../middlewares/auth");

// ✅ Existing history routes
router.get("/", protect, getNotifications);
router.get("/all", protect, isAdmin, getAllNotifications);
router.get("/user/:userId", protect, isAdmin, getNotificationsByUserId);

// ✅ Save token from frontend
router.post('/save-token', async (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ message: 'Token required' });
  }

  await saveToken(token);
  res.json({ message: 'Token saved successfully' });
});

const { sendPushNotifications } = require("../config/notifications");

// ✅ Send notification to all users
router.post('/send-notification', async (req, res) => {
  const { title, body } = req.body;
  const tokens = await getTokens();

  if (tokens.length === 0) {
    return res.json({ message: 'No tokens available' });
  }

  try {
    const results = await sendPushNotifications(tokens, title, body);
    
    // Also record this in our notification history database
    await Notification.create({
        title: title || 'Hello 👋',
        message: body || 'New Notification', 
        targetAll: true
    });

    res.json({ success: true, results });
  } catch (error) {
    console.error("Notification broadcast error:", error.message);
    res.status(500).json({ error: 'Notification failed' });
  }
});

module.exports = router;