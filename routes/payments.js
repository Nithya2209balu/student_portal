const express = require("express");
const router = express.Router();
const {
    getPaymentDashboard,
    getPaymentHistory,
    downloadPayslip,
    addManualPayment,
    getMonthlyReport,
    downloadReport,
    listPayments,
    getStudentCourseInfo,
} = require("../controllers/paymentController");
const { protect, isAdmin } = require("../middlewares/auth");

// 🔹 Student Routes
router.get("/student/:userId", protect, getPaymentDashboard);
router.get("/history/:userId", protect, getPaymentHistory);
router.get("/payslip/:userId", protect, downloadPayslip);

// 🔹 Admin Routes
router.post("/admin/add", protect, isAdmin, addManualPayment);
router.get("/admin/report", protect, isAdmin, getMonthlyReport);
router.get("/admin/report/download", protect, isAdmin, downloadReport);
router.get("/admin/list", protect, isAdmin, listPayments);
router.get("/admin/student-course/:userId", protect, isAdmin, getStudentCourseInfo);

module.exports = router;
