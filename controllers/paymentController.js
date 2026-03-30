const Payment = require("../models/Payment");
const User = require("../models/User");
const Course = require("../models/Course");
const PDFDocument = require("pdfkit");
const { Parser } = require("json2csv");

/**
 * 🔹 STUDENT: Get Payment Dashboard
 * GET /api/payments/student/:userId
 */
exports.getPaymentDashboard = async (req, res, next) => {
    try {
        const { userId } = req.params;
        const payment = await Payment.findOne({ userId }).sort({ createdAt: -1 });

        if (!payment) {
            // New fallback: Fetch from User -> Course if no payment record exists yet
            const user = await User.findById(userId).select("courseId courseName");
            if (user && user.courseId) {
                const course = await Course.findOne({ courseId: user.courseId });
                if (course) {
                    return res.json({
                        success: true,
                        data: {
                            totalFees: course.amount,
                            paidAmount: 0,
                            remainingAmount: course.amount,
                            durationInDays: 0,
                            daysLeft: 0,
                            status: "pending",
                            courseName: course.title
                        },
                    });
                }
            }

            return res.json({
                success: true,
                data: {
                    totalFees: 0,
                    paidAmount: 0,
                    remainingAmount: 0,
                    durationInDays: 0,
                    daysLeft: 0,
                    status: "pending",
                },
            });
        }

        const today = new Date();
        const end = new Date(payment.endDate);
        const daysLeft = Math.max(0, Math.ceil((end - today) / (1000 * 60 * 60 * 24)));

        res.json({
            success: true,
            data: {
                totalFees: payment.totalFees,
                paidAmount: payment.paidAmount,
                remainingAmount: payment.remainingAmount,
                durationInDays: payment.durationInDays,
                daysLeft,
                status: payment.status,
            },
        });
    } catch (err) {
        next(err);
    }
};

/**
 * 🔹 STUDENT: Payment History
 * GET /api/payments/history/:userId
 */
exports.getPaymentHistory = async (req, res, next) => {
    try {
        const { userId } = req.params;
        const payment = await Payment.findOne({ userId }).sort({ createdAt: -1 });

        res.json({
            success: true,
            transactions: payment ? payment.transactions : [],
        });
    } catch (err) {
        next(err);
    }
};

/**
 * 🔹 STUDENT: Download Payslip (PDF)
 * GET /api/payments/payslip/:userId
 */
exports.downloadPayslip = async (req, res, next) => {
    try {
        const { userId } = req.params;
        const payment = await Payment.findOne({ userId })
            .populate("userId", "name email")
            .populate("courseId", "title")
            .sort({ createdAt: -1 });

        if (!payment) return res.status(404).json({ success: false, message: "No payment record found" });

        const doc = new PDFDocument();
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename=payslip_${userId}.pdf`);

        doc.pipe(res);

        // Header
        doc.fontSize(20).text("PAYMENT PAYSLIP", { align: "center" });
        doc.moveDown();
        doc.fontSize(12).text(`Student Name: ${payment.userId.name}`);
        doc.text(`Course: ${payment.courseId.title}`);
        doc.text(`Date: ${new Date().toLocaleDateString()}`);
        doc.moveDown();

        // Summary
        doc.text(`Total Fees: ₹${payment.totalFees}`);
        doc.text(`Paid Amount: ₹${payment.paidAmount}`);
        doc.text(`Remaining Amount: ₹${payment.remainingAmount}`);
        doc.text(`Status: ${payment.status.toUpperCase()}`);
        doc.moveDown();

        // Transaction List
        doc.fontSize(14).text("Transaction Details", { underline: true });
        doc.moveDown(0.5);
        payment.transactions.forEach((tx, index) => {
            doc.fontSize(10).text(
                `${index + 1}. Amount: ₹${tx.amount} | Date: ${tx.date.toLocaleString()} | Method: ${tx.method}`
            );
        });

        doc.end();
    } catch (err) {
        next(err);
    }
};

/**
 * 🔹 ADMIN: Add Manual Payment
 * POST /api/payments/admin/add
 */
exports.addManualPayment = async (req, res, next) => {
    try {
        const { userId, courseId, amount, method } = req.body;
        const collectedBy = req.user.id; // Admin ID from protect middleare

        let payment = await Payment.findOne({ userId, courseId });

        if (!payment) {
            // First payment: Fetch course details for fees
            const course = await Course.findById(courseId);
            if (!course) return res.status(404).json({ success: false, message: "Course not found" });

            // Duration logic: Assume 90 days if not specified or fetch from course (if exists)
            const duration = 90;
            const endDate = new Date();
            endDate.setDate(endDate.getDate() + duration);

            payment = new Payment({
                userId,
                courseId,
                totalFees: course.amount,
                paidAmount: amount,
                remainingAmount: course.amount - amount,
                durationInDays: duration,
                endDate,
                transactions: [{ amount, method, collectedBy }],
            });
        } else {
            // Subsequent payment
            payment.paidAmount += amount;
            payment.remainingAmount -= amount;
            payment.transactions.push({ amount, method, collectedBy });
        }

        // Update Status
        if (payment.remainingAmount <= 0) {
            payment.status = "paid";
            payment.remainingAmount = 0; // Fix negative if overpaid
        } else if (payment.paidAmount > 0) {
            payment.status = "partial";
        }

        await payment.save();
        res.json({ success: true, message: "Payment added successfully", data: payment });
    } catch (err) {
        next(err);
    }
};

/**
 * 🔹 ADMIN: Monthly Report
 * GET /api/payments/admin/report
 */
exports.getMonthlyReport = async (req, res, next) => {
    try {
        const month = parseInt(req.query.month) || new Date().getMonth() + 1;
        const year = parseInt(req.query.year) || new Date().getFullYear();

        const start = new Date(year, month - 1, 1);
        const end = new Date(year, month, 0, 23, 59, 59);

        const payments = await Payment.find({
            createdAt: { $gte: start, $lte: end },
        });

        const report = {
            totalStudents: payments.length,
            paidStudents: payments.filter((p) => p.status === "paid").length,
            unpaidStudents: payments.filter((p) => p.status === "pending").length,
            totalCollection: payments.reduce((sum, p) => sum + p.paidAmount, 0),
        };

        res.json({ success: true, data: report });
    } catch (err) {
        next(err);
    }
};

/**
 * 🔹 ADMIN: Download Report (CSV)
 * GET /api/payments/admin/report/download
 */
exports.downloadReport = async (req, res, next) => {
    try {
        const payments = await Payment.find()
            .populate("userId", "name")
            .populate("courseId", "title");

        const data = payments.map((p) => ({
            "Student Name": p.userId ? p.userId.name : "Unknown",
            Course: p.courseId ? p.courseId.title : "Unknown",
            "Paid Amount": p.paidAmount,
            Remaining: p.remainingAmount,
            Status: p.status,
            "Last Transaction": p.transactions.length > 0 ? p.transactions[p.transactions.length - 1].date : "N/A",
        }));

        const json2csvParser = new Parser();
        const csv = json2csvParser.parse(data);

        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", "attachment; filename=payment_report.csv");
        res.status(200).send(csv);
    } catch (err) {
        next(err);
    }
};

/**
 * 🔹 ADMIN: Student Payment List
 * GET /api/payments/admin/list
 */
exports.listPayments = async (req, res, next) => {
    try {
        const { status, month } = req.query;
        let query = {};

        if (status) query.status = status;
        if (month) {
            const year = new Date().getFullYear();
            const start = new Date(year, month - 1, 1);
            const end = new Date(year, month, 0, 23, 59, 59);
            query.createdAt = { $gte: start, $lte: end };
        }

        const payments = await Payment.find(query)
            .populate("userId", "name email mobile")
            .populate("courseId", "title")
            .sort({ createdAt: -1 });

        res.json({ success: true, count: payments.length, data: payments });
    } catch (err) {
        next(err);
    }
};

/**
 * 🔹 ADMIN: Get Student Course & Fees (for form pre-fill)
 * GET /api/payments/admin/student-course/:userId
 */
exports.getStudentCourseInfo = async (req, res, next) => {
    try {
        const { userId } = req.params;
        const user = await User.findById(userId).select("name courseId courseName");

        if (!user) return res.status(404).json({ success: false, message: "Student not found" });

        // Try to find course details
        let course = null;
        if (user.courseId) {
            course = await Course.findOne({ courseId: user.courseId });
        }

        res.json({
            success: true,
            data: {
                studentName: user.name,
                courseId: course ? course._id : null, 
                courseNumber: user.courseId,
                courseTitle: course ? course.title : (user.courseName || "N/A"),
                fees: course ? course.amount : 0
            }
        });
    } catch (err) {
        next(err);
    }
};
