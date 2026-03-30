const express = require('express');
const axios = require('axios');
const router = express.Router();
const { saveToken, getTokens } = require('../db/tokens');
const Notification = require("../models/Notification"); // Kept for DB history
const { getNotifications, getAllNotifications } = require("../controllers/notificationController");
const { protect, isAdmin } = require("../middlewares/auth");

// ✅ Existing history routes
router.get("/", protect, getNotifications);
router.get("/all", protect, isAdmin, getAllNotifications);

// ✅ Save token from frontend
router.post('/save-token', async (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ message: 'Token required' });
  }

  await saveToken(token);
  res.json({ message: 'Token saved successfully' });
});

// ✅ Send notification to all users
router.post('/send-notification', async (req, res) => {
  const { title, body } = req.body;
  const tokens = await getTokens();

  if (tokens.length === 0) {
    return res.json({ message: 'No tokens available' });
  }

  try {
    const messages = tokens.map(token => ({
      to: token,
      sound: 'default',
      title: title || 'Hello 👋',
      body: body || 'Test Notification',
      data: { screen: 'home' }
    }));

    const response = await axios.post(
      'https://exp.host/--/api/v2/push/send',
      messages,
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    // Also record this in our notification history database
    await Notification.create({
        title: title || 'Hello 👋',
        message: body || 'Test Notification', 
        targetAll: true
    });

    res.json({ success: true, response: response.data });
  } catch (error) {
    console.log(error.message);
    res.status(500).json({ error: 'Notification failed' });
  }
});

module.exports = router;