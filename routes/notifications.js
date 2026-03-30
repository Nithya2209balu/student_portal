const express = require('express');
const router = express.Router();
const { 
    getNotifications, 
    getAllNotifications, 
    getNotificationsByUserId, 
    markAsRead, 
    deleteNotification,
    saveToken,
    sendBulkNotification
} = require("../controllers/notificationController");
const { protect, isAdmin } = require("../middlewares/auth");

// ── User Specific Routes ──────────────────────────────────────────────────
router.get("/", protect, getNotifications); 
router.patch("/:id/read", protect, markAsRead);
router.delete("/:id", protect, deleteNotification);
router.post('/save-token', protect, saveToken);

// ── Admin Only Routes ────────────────────────────────────────────────────
router.get("/all", protect, isAdmin, getAllNotifications);
router.get("/user/:userId", protect, isAdmin, getNotificationsByUserId);
router.post('/send-notification', protect, isAdmin, sendBulkNotification);

module.exports = router;