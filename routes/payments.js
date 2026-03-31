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
    downloadSingleReceipt,
} = require("../controllers/paymentController");
const { protect, isAdmin } = require("../middlewares/auth");

const hrOnly = (req, res, next) => {
    if (req.user.role !== "HR" && req.user.role !== "Manager" && req.user.role !== "admin") {
        return res.status(403).json({ success: false, message: "Access denied. Admin/HR only." });
    }
    next();
};

// 🔹 Student Routes
router.get("/student/:userId", protect, getPaymentDashboard);
router.get("/history/:userId", protect, getPaymentHistory);
router.get("/payslip/:userId", protect, downloadPayslip);
router.get("/receipt/:paymentId/:transactionId", protect, downloadSingleReceipt);

// 🔹 Admin/HR Routes
router.post("/admin/add", protect, hrOnly, addManualPayment);
router.get("/admin/report", protect, hrOnly, getMonthlyReport);
router.get("/admin/report/download", protect, hrOnly, downloadReport);
router.get("/admin/list", protect, hrOnly, listPayments);
router.get("/admin/student-course/:userId", protect, hrOnly, getStudentCourseInfo);

module.exports = router;
