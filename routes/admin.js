const express = require("express");
const router = express.Router();
const { protect, isAdmin } = require("../middlewares/auth");
const {
    listPendingStudents,
    listAllStudents,
    approveStudent,
    rejectStudent,
    getStudentById,
} = require("../controllers/authController");

// All admin routes require a valid JWT + admin role
router.use(protect, isAdmin);

router.get("/students/pending", listPendingStudents);   // GET  /api/admin/students/pending
router.get("/students", listAllStudents);               // GET  /api/admin/students
router.get("/students/:id", getStudentById);            // GET  /api/admin/students/:id
router.patch("/students/:id/approve", approveStudent); // PATCH /api/admin/students/:id/approve
router.patch("/students/:id/reject", rejectStudent);   // PATCH /api/admin/students/:id/reject

module.exports = router;
