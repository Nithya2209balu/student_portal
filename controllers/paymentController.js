const Payment = require("../models/Payment");
const User = require("../models/User");
const Course = require("../models/Course");
const PDFDocument = require("pdfkit");
const ExcelJS = require("exceljs");

/**
 * 🔹 STUDENT: Get Payment Dashboard
 * GET /api/payments/student/:userId
 */
exports.getPaymentDashboard = async (req, res, next) => {
    try {
        const { userId } = req.params;
        const payment = await Payment.findOne({ userId }).sort({ createdAt: -1 });

        if (!payment) {
            // New fallback: Fetch from User -> Course OR CourseCategory if no payment record exists yet
            const user = await User.findById(userId).select("courseId courseName");
            if (user) {
                let totalFees = 0;
                let courseName = user.courseName || "N/A";

                // 1. Try lookup by courseId (Number) in Course collection
                if (user.courseId) {
                    const course = await Course.findOne({ courseId: user.courseId });
                    if (course) {
                        totalFees = course.amount;
                        courseName = course.title || course.name || courseName;
                    }
                }

                // 2. Fallback to Name-based lookup in Courses if fee still 0
                if (totalFees === 0 && user.courseName) {
                    const course = await Course.findOne({ 
                        $or: [{ title: user.courseName }, { name: user.courseName }] 
                    });
                    if (course) {
                        totalFees = course.amount;
                    }
                }

                // 3. Fallback to Category-based lookup (many students are linked to category names)
                if (totalFees === 0 && user.courseName) {
                    const CourseCategory = require("../models/CourseCategory");
                    const category = await CourseCategory.findOne({ name: user.courseName });
                    if (category) {
                        totalFees = category.fees || 0;
                    }
                }

                if (totalFees > 0) {
                    return res.json({
                        success: true,
                        data: {
                            totalFees,
                            paidAmount: 0,
                            remainingAmount: totalFees,
                            durationInDays: 0,
                            daysLeft: 0,
                            status: "pending",
                            courseName
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
        const collectedBy = req.user.id; 

        // Normalize courseId: Mongoose fails if it's an empty string ""
        const normalizedCourseId = (courseId && typeof courseId === 'string' && courseId.trim() !== '') ? courseId : null;

        if (!userId || !amount || !method) {
            return res.status(400).json({ success: false, message: 'Please provide student, amount and method' });
        }

        let payment = await Payment.findOne({ userId });

        if (!payment) {
            // First payment: Fetch course details for fees
            let courseAmount = 0;
            if (normalizedCourseId) {
                const course = await Course.findById(normalizedCourseId);
                if (course) courseAmount = course.amount;
            }

            // Duration logic: 90 days
            const duration = 90;
            const endDate = new Date();
            endDate.setDate(endDate.getDate() + duration);

            payment = new Payment({
                userId,
                courseId: normalizedCourseId,
                totalFees: courseAmount,
                paidAmount: amount,
                remainingAmount: Math.max(0, courseAmount - amount),
                durationInDays: duration,
                endDate,
                transactions: [{ amount, method, collectedBy }],
            });
        } else {
            // Subsequent payment
            payment.paidAmount += amount;
            payment.remainingAmount = Math.max(0, payment.totalFees - payment.paidAmount);
            payment.transactions.push({ amount, method, collectedBy });
            if (normalizedCourseId && !payment.courseId) {
                payment.courseId = normalizedCourseId;
            }
        }

        // Update Status
        if (payment.remainingAmount <= 0) {
            payment.status = "paid";
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

        // Use Set to count unique students
        const totalStudents = new Set(payments.map(p => p.userId.toString())).size;
        const paidStudents = new Set(payments.filter(p => p.status === "paid").map(p => p.userId.toString())).size;
        
        const report = {
            totalStudents,
            paidStudents,
            unpaidStudents: totalStudents - paidStudents,
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
            .populate("userId", "name email mobile")
            .populate("courseId", "title courseId");

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Payments');

        worksheet.columns = [
            { header: 'Student Name', key: 'name', width: 25 },
            { header: 'Email', key: 'email', width: 25 },
            { header: 'Course', key: 'course', width: 20 },
            { header: 'Total Fees', key: 'total', width: 15 },
            { header: 'Amount Paid', key: 'paid', width: 15 },
            { header: 'Remaining', key: 'remaining', width: 15 },
            { header: 'Status', key: 'status', width: 15 },
            { header: 'Date', key: 'date', width: 20 }
        ];

        payments.forEach(p => {
            worksheet.addRow({
                name: p.userId ? p.userId.name : 'Unknown',
                email: p.userId ? p.userId.email : 'N/A',
                course: p.courseId ? p.courseId.title : 'N/A',
                total: p.totalFees,
                paid: p.paidAmount,
                remaining: p.remainingAmount,
                status: p.status,
                date: p.createdAt ? p.createdAt.toLocaleDateString() : 'N/A'
            });
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=payment-report.xlsx');

        await workbook.xlsx.write(res);
        res.end();
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
        const { status, month, year } = req.query;
        let query = {};

        if (status && status !== 'all') {
            query.status = status;
        }

        if (month && year) {
            const m = parseInt(month) - 1;
            const y = parseInt(year);
            query.createdAt = {
                $gte: new Date(y, m, 1),
                $lte: new Date(y, m + 1, 0, 23, 59, 59, 999)
            };
        }

        const payments = await Payment.find(query)
            .populate("userId", "name email mobile")
            .sort({ createdAt: -1 });

        // Map to expected frontend format
        const formatted = payments.map(p => ({
            _id: p._id,
            name: p.userId?.name || 'Unknown',
            // User model has courseName for offline students; 
            // otherwise use a fallback or populate Course title
            course: p.userId?.courseName || 'N/A',
            paid: p.paidAmount || 0,
            remaining: p.remainingAmount || 0,
            status: p.status,
            method: p.transactions.length > 0 ? p.transactions[p.transactions.length - 1].method : 'N/A',
            date: p.createdAt
        }));

        res.json({ success: true, count: formatted.length, data: formatted });
    } catch (err) {
        next(err);
    }
};

/**
 * 🔹 ADMIN: Get Student Course & Fees + Payment Summary (for form pre-fill)
 * GET /api/payments/admin/student-course/:userId
 */
exports.getStudentCourseInfo = async (req, res, next) => {
    try {
        const { userId } = req.params;
        const user = await User.findById(userId).select("name courseId courseName");

        if (!user) return res.status(404).json({ success: false, message: "Student not found" });

        let fees = 0;
        let courseTitle = user.courseName || "N/A";
        let courseObjectId = null;

        // 1. Try lookup by courseId (Number) in Course collection
        if (user.courseId) {
            const course = await Course.findOne({ courseId: user.courseId });
            if (course) {
                fees = course.amount;
                courseTitle = course.title || course.name || courseTitle;
                courseObjectId = course._id;
            }
        }

        // 2. Fallback to Name-based lookup in Courses if fee still 0
        if (fees === 0 && user.courseName) {
            const course = await Course.findOne({
                $or: [{ title: user.courseName }, { name: user.courseName }],
            });
            if (course) {
                fees = course.amount;
                courseObjectId = course._id;
                courseTitle = course.title || course.name;
            }
        }

        // 3. Fallback to Category-based lookup
        if (fees === 0 && user.courseName) {
            const CourseCategory = require("../models/CourseCategory");
            const category = await CourseCategory.findOne({ name: user.courseName });
            if (category) {
                fees = category.fees || 0;
                courseTitle = category.name;
            }
        }

        // 4. Fetch existing payment record to get paidAmount & remainingAmount
        const existingPayment = await Payment.findOne({ userId }).sort({ createdAt: -1 });
        const paidAmount      = existingPayment ? existingPayment.paidAmount      : 0;
        const remainingAmount = existingPayment ? existingPayment.remainingAmount  : fees;

        res.json({
            success: true,
            data: {
                studentName: user.name,
                courseId: courseObjectId,
                courseNumber: user.courseId,
                courseTitle,
                fees,
                paidAmount,
                remainingAmount,
            },
        });
    } catch (err) {
        next(err);
    }
};
