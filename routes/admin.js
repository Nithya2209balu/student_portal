const express = require("express");
const router = express.Router();
const { protect, isAdmin } = require("../middlewares/auth");
const {
    listPendingStudents,
    listAllStudents,
    approveStudent,
    rejectStudent,
    getStudentById,
    updateStudentById,
    deleteStudentById,
} = require("../controllers/authController");

// All admin routes require a valid JWT + admin role
router.use(protect, isAdmin);

router.get("/students/pending", listPendingStudents);   // GET  /api/admin/students/pending
router.get("/students", listAllStudents);               // GET  /api/admin/students
router.patch("/students/:id/approve", approveStudent); // PATCH /api/admin/students/:id/approve
router.patch("/students/:id/reject", rejectStudent);   // PATCH /api/admin/students/:id/reject

// Generic CRUD by ID
router.get("/students/:id", getStudentById);           // GET    /api/admin/students/:id
router.put("/students/:id", updateStudentById);        // PUT    /api/admin/students/:id
router.delete("/students/:id", deleteStudentById);     // DELETE /api/admin/students/:id

module.exports = router;
