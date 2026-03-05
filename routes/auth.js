const express = require("express");
const router = express.Router();
const {
    register,
    login,
    forgotPassword,
    verifyOTP,
    loginWithOTP,
} = require("../controllers/authController");

router.post("/register", register);
router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.post("/verify-otp", verifyOTP);
router.post("/login-with-otp", loginWithOTP);

module.exports = router;
