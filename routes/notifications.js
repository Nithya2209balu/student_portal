const express = require("express");
const router = express.Router();
const { getNotifications, getAllNotifications, saveToken, sendBulkNotification } = require("../controllers/notificationController");
const { protect, isAdmin } = require("../middlewares/auth");

router.get("/", protect, getNotifications);
router.get("/all", protect, isAdmin, getAllNotifications);
router.post("/save-token", protect, saveToken);
router.post("/send-notification", protect, isAdmin, sendBulkNotification);

module.exports = router;
