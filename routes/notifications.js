const express = require("express");
const router = express.Router();
const { getNotifications } = require("../controllers/notificationController");
const { protect } = require("../middlewares/auth");

router.get("/", protect, getNotifications);

module.exports = router;
