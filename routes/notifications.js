const express = require("express");
const router = express.Router();
const { getNotifications, getAllNotifications } = require("../controllers/notificationController");
const { protect, isAdmin } = require("../middlewares/auth");

router.get("/all", protect, isAdmin, getAllNotifications); // Must be above "/"
router.get("/", protect, getNotifications);

module.exports = router;
