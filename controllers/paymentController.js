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
        const payment = await Payment.findOne({ userId })
            .populate("courseId", "title isActive")
            .sort({ createdAt: -1 });

        if (!payment) {
            // New fallback: Fetch from User -> Course
            const user = await User.findById(userId).select("courseId courseName");
            if (user) {
                let totalFees = 0;
                let courseName = user.courseName || "N/A";

                if (user.courseId) {
                    const course = await Course.findOne({ courseId: user.courseId });
                    if (course) {
                        totalFees = course.amount;
                        courseName = course.title || course.name || courseName;
                    }
                }

                if (totalFees > 0) {
                    return res.json({
                        success: true,
                        data: {
                            totalFees,
                            paidAmount: 0,
                            remainingAmount: totalFees,
                            status: "pending",
                            courseName,
                            nextInstallmentDate: null
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
                    status: "pending"
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
                daysLeft,
                status: payment.status,
                courseName: payment.courseId?.title || "N/A",
                nextInstallmentDate: payment.nextInstallmentDate || null,
                paymentDeadline: payment.nextInstallmentDate || payment.endDate // Explicitly mapping deadline
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
        const payment = await Payment.findOne({ userId })
            .populate("courseId", "title")
            .sort({ createdAt: -1 });

        if (!payment) return res.json({ success: true, transactions: [] });

        // Self-heal: If totalFees is 0 or courseName is generic, try to find the real values
        let dynamicFees = payment.totalFees;
        let dynamicCourseTitle = payment.courseId?.title || "Course";

        if (dynamicFees === 0 || dynamicCourseTitle === "Course") {
            const user = await User.findById(userId).select("courseName courseId");
            if (user) {
                if (dynamicCourseTitle === "Course") dynamicCourseTitle = user.courseName || dynamicCourseTitle;
                
                // 1. Try lookup by courseId (Number)
                let course = null;
                if (user.courseId) {
                    course = await Course.findOne({ courseId: user.courseId });
                }

                // 2. Fallback to Name-based lookup
                if (!course && user.courseName) {
                    course = await Course.findOne({ 
                        $or: [{ title: user.courseName }, { name: user.courseName }] 
                    });
                }

                if (course) {
                    if (dynamicFees === 0) dynamicFees = course.amount;
                    if (!dynamicCourseTitle || dynamicCourseTitle === "Course") dynamicCourseTitle = course.title || course.name;
                } else if (user.courseName) {
                    // 3. Fallback to Category-based lookup (crucial for some students)
                    const CourseCategory = require("../models/CourseCategory");
                    const category = await CourseCategory.findOne({ name: user.courseName });
                    if (category) {
                        if (dynamicFees === 0) dynamicFees = category.fees || 0;
                    }
                }
            }
        }

        const transactions = payment.transactions.map(tx => ({
            _id: tx._id,
            paymentId: payment._id, 
            date: tx.date,
            method: tx.method,
            type: tx.type || "Installment",
            receiptId: tx.receiptId || `REC-${Math.floor(1000 + Math.random() * 9000)}`,
            status: tx.status || "success",
            courseName: dynamicCourseTitle,
            totalAmount: dynamicFees,
            paidAmount: payment.paidAmount,
            pendingAmount: Math.max(0, dynamicFees - payment.paidAmount)
        }));

        res.json({
            success: true,
            transactions: transactions,
        });
    } catch (err) {
        next(err);
    }
};

/**
 * 🔹 STUDENT: Download Single Transaction Receipt (PDF)
 * GET /api/payments/receipt/:paymentId/:transactionId
 */
exports.downloadSingleReceipt = async (req, res, next) => {
    try {
        const { paymentId, transactionId } = req.params;
        const payment = await Payment.findById(paymentId)
            .populate("userId", "name email")
            .populate("courseId", "title");

        if (!payment) return res.status(404).json({ success: false, message: "Payment record not found" });

        const tx = payment.transactions.id(transactionId);
        if (!tx) return res.status(404).json({ success: false, message: "Transaction not found" });

        const doc = new PDFDocument({ margin: 50 });
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename=receipt_${tx.receiptId || transactionId}.pdf`);

        doc.pipe(res);

        // --- 🔹 DYNAMIC DATA HEALING for RECEIPT ---
        let courseName = payment.courseId?.title || "N/A";
        let totalFees = payment.totalFees || 0;

        if (courseName === "N/A" || totalFees === 0) {
            const User = require("../models/User");
            const Course = require("../models/Course");
            const user = await User.findById(payment.userId).select("courseName courseId");
            if (user) {
                if (courseName === "N/A") courseName = user.courseName || "N/A";
                let foundCourse = null;
                if (user.courseId) foundCourse = await Course.findOne({ courseId: user.courseId });
                if (!foundCourse && user.courseName) foundCourse = await Course.findOne({ $or: [{ title: user.courseName }, { name: user.courseName }] });
                
                if (foundCourse) {
                    if (totalFees === 0) totalFees = foundCourse.amount;
                    if (courseName === "N/A") courseName = foundCourse.title;
                } else if (user.courseName) {
                    const CourseCategory = require("../models/CourseCategory");
                    const category = await CourseCategory.findOne({ name: user.courseName });
                    if (category && totalFees === 0) totalFees = category.fees || 0;
                }
            }
        }
        
        const remaining = Math.max(0, totalFees - payment.paidAmount);

        // --- 🔹 DESIGN TEMPLATE ---
        
        // 1. Header & Border
        doc.rect(20, 20, 555, 750).stroke("#CCCCCC");
        doc.fillColor("#1A237E").fontSize(24).text("BY8 LABS", { align: "center" });
        doc.fontSize(10).fillColor("#666666").text("Official Payment Receipt", { align: "center" });
        doc.moveDown(2);

        // 2. Receipt Info Block
        doc.fillColor("#000000").fontSize(10)
           .text(`Receipt ID: ${tx.receiptId || "N/A"}`, 400, 100)
           .text(`Date: ${tx.date.toLocaleDateString()}`, 400, 115);

        // 3. Student Details
        doc.fillColor("#1A237E").fontSize(12).text("Student Details", 50, 140);
        doc.rect(50, 155, 250, 1).fill("#1A237E");
        doc.moveDown(0.5);
        doc.fillColor("#000000").fontSize(11)
           .text(`Name: ${payment.userId.name}`, 50, 165)
           .text(`Email: ${payment.userId.email}`, 50, 180)
           .text(`Course: ${courseName}`, 50, 195);

        // 4. Transaction Summary Table
        doc.moveDown(2);
        const tableTop = 230;
        doc.fillColor("#F5F5F5").rect(50, tableTop, 500, 25).fill();
        doc.fillColor("#1A237E").fontSize(10)
           .text("DESCRIPTION", 60, tableTop + 7)
           .text("PAYMENT MODE", 300, tableTop + 7)
           .text("AMOUNT", 480, tableTop + 7);

        doc.fillColor("#000000").fontSize(11)
           .text(tx.type || "Installment Payment", 60, tableTop + 40)
           .text(tx.method?.toUpperCase() || "CASH", 300, tableTop + 40)
           .text(`Rs. ${tx.amount}`, 480, tableTop + 40);

        doc.rect(50, tableTop + 60, 500, 1).fill("#EEEEEE");

        // 5. Grand Totals 
        doc.moveDown(3);
        const summaryTop = doc.y + 20;
        doc.fillColor("#000000").fontSize(10)
           .text("Total Course Fees:", 350, summaryTop)
           .text(`Rs. ${totalFees}`, 480, summaryTop)
           .text("Currently Paid Total:", 350, summaryTop + 20)
           .text(`Rs. ${payment.paidAmount}`, 480, summaryTop + 20);

        doc.fillColor("#B71C1C").fontSize(12).font("Helvetica-Bold")
           .text("BALANCE DUE:", 350, summaryTop + 45)
           .text(`Rs. ${remaining}`, 480, summaryTop + 45);

        // 6. Footer & Stamp Area
        doc.font("Helvetica").fontSize(8).fillColor("#999999")
           .text("--------------------------------------------------", 50, 680)
           .text("This is a computer generated receipt. No signature required.", 50, 690, { align: "center", width: 500 });

        doc.fontSize(12).fillColor("#1A237E").text("PAID", 450, 630, { characterSpacing: 5 });

        doc.end();
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
        const { userId, courseId, amount, method, type } = req.body;
        const collectedBy = req.user.id; 
        
        const numAmount = Number(amount);

        if (!userId || isNaN(numAmount) || !method) {
            return res.status(400).json({ success: false, message: 'Please provide valid student, amount and method' });
        }

        const mongoose = require("mongoose");
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ success: false, message: 'Invalid user ID format' });
        }

        // Generate unique receipt ID
        const receiptId = `REC-${Math.floor(1000 + Math.random() * 9000)}`;

        // Smart Course/Fee Lookup for initialization
        let normalizedCourseId = courseId;
        let totalFees = 0;
        const user = await User.findById(userId);

        if (user) {
            const course = await Course.findOne({
                $or: [
                    { courseId: user.courseId || "" },
                    { title: { $regex: new RegExp("^" + (user.courseName || "").trim().replace(/\s+/g, "\\s*") + "$", "i") } }
                ],
            });

            if (course) {
                normalizedCourseId = course._id;
                totalFees = course.amount;
            } else if (user.courseName) {
                const CourseCategory = require("../models/CourseCategory");
                const category = await CourseCategory.findOne({ name: user.courseName });
                if (category) totalFees = category.fees || 0;
            }
        }

        let payment = await Payment.findOne({ userId });

        if (!payment) {
            // First payment: Fetch course details for fees
            let courseAmount = 0;
            if (normalizedCourseId && mongoose.Types.ObjectId.isValid(normalizedCourseId)) {
                const course = await Course.findById(normalizedCourseId);
                if (course) courseAmount = course.amount;
            }

            // Next Installment Date: Default to 30 days from now
            const nextInstallment = new Date();
            nextInstallment.setDate(nextInstallment.getDate() + 30);

            // Duration logic: 90 days
            const duration = 90;
            const endDate = new Date();
            endDate.setDate(endDate.getDate() + duration);

            payment = new Payment({
                userId,
                courseId: courseId || undefined,
                totalFees: courseAmount,
                paidAmount: numAmount,
                remainingAmount: Math.max(0, courseAmount - numAmount),
                durationInDays: duration,
                endDate,
                nextInstallmentDate: nextInstallment,
                transactions: [{ 
                    amount: numAmount, 
                    method, 
                    collectedBy,
                    type: type || "Admission Fee",
                    receiptId,
                    status: "success"
                }],
            });
        } else {
            // Subsequent payment
            payment.paidAmount += numAmount;
            payment.remainingAmount = Math.max(0, payment.totalFees - payment.paidAmount);
            
            // Update next installment date (+30 days from previous)
            const nextInstallment = new Date();
            nextInstallment.setDate(nextInstallment.getDate() + 30);
            payment.nextInstallmentDate = nextInstallment;

            payment.transactions.push({ 
                amount: numAmount, 
                method, 
                collectedBy,
                type: type || `Installment ${payment.transactions.length}`,
                receiptId,
                status: "success"
            });
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
        if (err.name === 'ValidationError') {
            return res.status(400).json({ success: false, message: err.message });
        }
        if (err.name === 'CastError') {
            return res.status(400).json({ success: false, message: 'Invalid ID format in request' });
        }
        next(err);
    }
};

/**
 * 🔹 ADMIN: Monthly Report
 * GET /api/payments/admin/report
 */
exports.getMonthlyReport = async (req, res, next) => {
    try {
        const { month, year, startDate, endDate, userId } = req.query;
        let query = {};
        if (userId) query.userId = userId;

        if (month && year) {
            const start = new Date(year, month - 1, 1);
            const end = new Date(year, month, 0, 23, 59, 59);
            query.createdAt = { $gte: start, $lte: end };
        } else if (startDate && endDate) {
            query.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
        }

        const payments = await Payment.find(query);

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
        const { status, month, year, startDate, endDate, userId } = req.query;

        let query = {};
        if (status && status !== "all") query.status = status;
        if (userId) query.userId = userId;

        if (month && year) {
            const start = new Date(year, month - 1, 1);
            const end = new Date(year, month, 0);
            query.createdAt = { $gte: start, $lte: end };
        } else if (startDate && endDate) {
            query.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
        }

        const payments = await Payment.find(query)
            .populate("userId", "name email mobile courseName courseId")
            .populate("courseId", "title");

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

        for (const p of payments) {
            let total = p.totalFees || 0;
            let courseName = p.courseId?.title || p.userId?.courseName || "N/A";

            if (total === 0 || courseName === "N/A") {
                const user = p.userId;
                if (user) {
                    if (courseName === "N/A") courseName = user.courseName || courseName;
                    const Course = require("../models/Course");
                    let foundCourse = null;
                    if (user.courseId) foundCourse = await Course.findOne({ courseId: user.courseId });
                    if (!foundCourse && user.courseName) {
                        foundCourse = await Course.findOne({ $or: [{ title: user.courseName }, { name: user.courseName }] });
                    }
                    if (foundCourse) {
                        if (total === 0) total = foundCourse.amount;
                        if (courseName === "N/A" || !courseName) courseName = foundCourse.title || foundCourse.name;
                    } else if (user.courseName) {
                        const CourseCategory = require("../models/CourseCategory");
                        const category = await CourseCategory.findOne({ name: user.courseName });
                        if (category && total === 0) total = category.fees || 0;
                    }
                }
            }

            const paid = p.paidAmount || 0;
            const remaining = Math.max(0, total - paid);

            worksheet.addRow({
                name: p.userId ? p.userId.name : 'Unknown',
                email: p.userId ? p.userId.email : 'N/A',
                course: courseName,
                total: total,
                paid: paid,
                remaining: remaining,
                status: p.status,
                date: p.createdAt ? p.createdAt.toLocaleDateString() : 'N/A'
            });
        }

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
        const { status, month, year, startDate, endDate, userId } = req.query;
        
        let paymentQuery = {};
        if (status && status !== "all") paymentQuery.status = status;
        if (userId) paymentQuery.userId = userId;

        const hasDateFilter = (month && year) || (startDate && endDate);

        if (month && year) {
            const m = parseInt(month) || new Date().getMonth() + 1;
            const y = parseInt(year) || new Date().getFullYear();
            const start = new Date(y, m - 1, 1);
            const end = new Date(y, m, 0, 23, 59, 59);
            paymentQuery.createdAt = { $gte: start, $lte: end };
        } else if (startDate && endDate) {
            paymentQuery.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
        }

        let results = [];

        // MODE 1: Filtered Report OR User-specific List
        // If we have filters, we start with the Payment collection to match the "Report" UI
        if (hasDateFilter || userId || (status && status !== "all")) {
            const payments = await Payment.find(paymentQuery)
                .populate("userId", "name email mobile courseName courseId")
                .populate("courseId", "title")
                .sort({ createdAt: -1 });

            results = await Promise.all(payments.map(async (p) => {
                return await formatPaymentData(p);
            }));
        } 
        // MODE 2: General Student List (No specific report filters)
        // We start with the User model to show ALL students (including non-paid ones)
        else {
            // Using regex for role to handle inconsistent data like "student      t"
            const students = await User.find({ role: /^student/i }).select("name email mobile courseName courseId createdAt");
            const allPayments = await Payment.find().populate("courseId", "title");

            results = await Promise.all(students.map(async (student) => {
                const payment = allPayments.find(p => p.userId.toString() === student._id.toString());
                return await formatPaymentData(payment, student);
            }));
        }

        // Final cleanup and sorting
        const finalData = results.filter(item => item !== null).sort((a, b) => new Date(b.date) - new Date(a.date));

        res.json({ success: true, count: finalData.length, data: finalData });
    } catch (err) {
        next(err);
    }
};

// Helper to unify data formatting and self-healing
async function formatPaymentData(payment, studentUser = null) {
    const user = studentUser || payment?.userId;
    if (!user) return null;

    let total = payment?.totalFees || 0;
    let paid = payment?.paidAmount || 0;
    let courseName = payment?.courseId?.title || user.courseName || "N/A";
    let duration = payment?.durationInDays || 90;

    // Self-heal logic
    if (total === 0 || courseName === "N/A") {
        const Course = require("../models/Course");
        const CourseCategory = require("../models/CourseCategory");
        
        let foundCourse = null;
        if (user.courseId) foundCourse = await Course.findOne({ courseId: user.courseId });
        if (!foundCourse && user.courseName) {
            foundCourse = await Course.findOne({ $or: [{ title: user.courseName }, { name: user.courseName }] });
        }

        if (foundCourse) {
            if (total === 0) total = foundCourse.amount;
            if (!courseName || courseName === "N/A") courseName = foundCourse.title || foundCourse.name;
        } else if (user.courseName) {
            const category = await CourseCategory.findOne({ name: user.courseName });
            if (category && total === 0) total = category.fees || 0;
        }
    }

    const remaining = Math.max(0, total - paid);
    
    return {
        _id: user._id,
        paymentId: payment?._id || null,
        name: user.name,
        course: courseName,
        duration: duration,
        totalFees: total,
        paidAmount: paid,
        pendingAmount: remaining,
        status: remaining <= 0 && total > 0 ? "paid" : (paid > 0 ? "partial" : "pending"),
        method: payment?.transactions?.length > 0 ? payment.transactions[payment.transactions.length - 1].method : 'N/A',
        date: payment?.createdAt || user.createdAt
    };
}

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

        // 2. Fallback to Regex-based Name lookup in Courses
        if (user.courseName) {
            const course = await Course.findOne({
                $or: [
                    { title: { $regex: new RegExp("^" + user.courseName.trim().replace(/\s+/g, "\\s*") + "$", "i") } },
                    { name: { $regex: new RegExp("^" + user.courseName.trim().replace(/\s+/g, "\\s*") + "$", "i") } }
                ],
            });
            if (course) {
                if (fees === 0) fees = course.amount;
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
                courseObjectId = category._id; // ✅ FIXED: Set ID from category if course not found
            }
        }

        // 4. Fetch existing payment record to get paidAmount
        const existingPayment = await Payment.findOne({ userId }).sort({ createdAt: -1 });
        const paidAmount      = existingPayment ? existingPayment.paidAmount : 0;
        
        // 5. Calculate remaining amount dynamically to ensure UI consistency
        // Requirement: remaining = total - paid
        const remainingAmount = Math.max(0, fees - paidAmount);

        res.json({
            success: true,
            data: {
                studentName: user.name,
                courseId: courseObjectId,
                courseNumber: user.courseId,
                courseTitle,
                fees, // Traditional field
                totalAmount: fees, // Prompt requirement name
                paidAmount,
                remainingAmount, // Traditional field
                balanceAmount: remainingAmount, // Prompt requirement name
            },
        });
    } catch (err) {
        next(err);
    }
};
