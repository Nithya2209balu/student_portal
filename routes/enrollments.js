const express = require("express");
const router = express.Router();
const { getMyCourses } = require("../controllers/enrollmentController");
const { protect } = require("../middlewares/auth");

router.get("/my-courses", protect, getMyCourses);

module.exports = router;
