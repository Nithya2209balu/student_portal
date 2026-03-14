const express = require("express");
const router = express.Router();
const {
    getCategories,
    getCourses,
    getCourseAbout,
    enrollCourse,
    getCourseLessons,
    askDoubt,
    getDoubts,
    storeNote,
    getNotes,
    getLessonMCQ,
    submitQuiz,
    getLessonQuizScores,
    createCategory,
} = require("../controllers/courseController");
const { protect, isAdmin } = require("../middlewares/auth");

// ── Category & Listing ──────────────────────────────────────────────────────
router.get("/categories", protect, getCategories);
router.post("/categories", protect, isAdmin, createCategory);
router.get("/", protect, getCourses);

// ── Lesson-level (must come before /:id routes to avoid conflicts) ──────────
router.get("/lessons/:lessonId/mcq", protect, getLessonMCQ);
router.post("/lessons/:lessonId/quiz-score", protect, submitQuiz);
router.get("/lessons/:lessonId/quiz-score", protect, getLessonQuizScores);

// ── Course-level ─────────────────────────────────────────────────────────────
router.get("/:id/about", protect, getCourseAbout);
router.post("/:id/enroll", protect, enrollCourse);
router.get("/:id/lessons", protect, getCourseLessons);
router.post("/:id/doubts", protect, askDoubt);
router.get("/:id/doubts", protect, getDoubts);
router.post("/:id/notes", protect, storeNote);
router.get("/:id/notes", protect, getNotes);

module.exports = router;
