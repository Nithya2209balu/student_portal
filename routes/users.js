const express = require("express");
const router = express.Router();
const multer = require("multer");
const { protect } = require("../middlewares/auth");
const { updateFCMToken } = require("../controllers/authController");
const { uploadProfileImage, updateUserProfile } = require("../controllers/userController");

const upload = multer({ storage: multer.memoryStorage() });

// Public route to update FCM token (uses email/password verification)
router.put("/update-fcm-token", updateFCMToken);

/**
 * 🔹 USER: Upload Profile Image
 * POST /api/users/upload-profile/:userId
 */
router.post("/upload-profile/:userId", protect, upload.single("image"), uploadProfileImage);

/**
 * 🔹 USER: Update Profile
 * PUT /api/users/update/:userId
 */
router.put("/update/:userId", protect, updateUserProfile);

module.exports = router;
