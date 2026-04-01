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
                            courseStatus: "active",
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
                    status: "pending",
                    courseStatus: "inactive"
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
                courseStatus: payment.courseId?.isActive ? "active" : "inactive",
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
            pendingAmount: Math.max(0, dynamicFees - payment.paidAmount),
            balanceAmount: Math.max(0, dynamicFees - payment.paidAmount) // Alias for compatibility
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

        // Header Style
        doc.fillColor("#444444").fontSize(20).text("PAYMENT RECEIPT", { align: "center" });
        doc.moveDown();

        // Receipt Details
        doc.fontSize(10)
           .text(`Receipt ID: ${tx.receiptId || "N/A"}`, { align: "right" })
           .text(`Date: ${tx.date.toLocaleDateString()}`, { align: "right" });

        doc.moveDown();
        doc.fontSize(12).fillColor("#000000")
           .text(`Student Name: ${payment.userId.name}`)
           .text(`Email: ${payment.userId.email}`)
           .text(`Course: ${payment.courseId?.title || "N/A"}`);

        doc.moveDown();
        doc.rect(50, doc.y, 500, 1).fill("#EEEEEE");
        doc.moveDown();

        // Transaction Info
        doc.fontSize(14).fillColor("#2E7D32").text(`${tx.type || "Installment Payment"}`);
        doc.moveDown(0.5);
        
        doc.fontSize(12).fillColor("#000000")
           .text(`Amount Paid: ₹${tx.amount}`)
           .text(`Payment Mode: ${tx.method?.toUpperCase() || "CASH"}`)
           .text(`Status: ${tx.status?.toUpperCase() || "SUCCESS"}`);

        doc.moveDown();
        doc.rect(50, doc.y, 500, 1).fill("#EEEEEE");
        doc.moveDown();

        // Footer
        doc.fontSize(10).fillColor("#777777")
           .text("Thank you for your payment!", { align: "center" });

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

        // Smart Course Lookup for fee initialization
        let normalizedCourseId = courseId;
        if (!normalizedCourseId || !mongoose.Types.ObjectId.isValid(normalizedCourseId)) {
            const user = await User.findById(userId);
            if (user && user.courseName) {
                const foundCourse = await Course.findOne({ 
                    $or: [{ title: user.courseName }, { name: user.courseName }] 
                });
                if (foundCourse) normalizedCourseId = foundCourse._id;
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
        
        let query = {};
        if (status && status !== "all") query.status = status;
        if (userId) query.userId = userId;

        if (month && year) {
            const m = parseInt(month) || new Date().getMonth() + 1;
            const y = parseInt(year) || new Date().getFullYear();
            const start = new Date(y, m - 1, 1);
            const end = new Date(y, m, 0, 23, 59, 59);
            query.createdAt = { $gte: start, $lte: end };
        } else if (startDate && endDate) {
            query.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
        }

        const payments = await Payment.find(query)
            .populate("userId", "name email mobile courseName courseId")
            .populate("courseId", "title")
            .sort({ createdAt: -1 });

        const formatted = await Promise.all(payments.map(async (p) => {
            let total = p.totalFees || 0;
            let courseName = p.courseId?.title || p.userId?.courseName || "N/A";

            // Self-heal logic
            if (total === 0 || courseName === "N/A") {
                const User = require("../models/User");
                const Course = require("../models/Course");
                const user = p.userId || await User.findById(p.userId);
                if (user) {
                    if (courseName === "N/A") courseName = user.courseName || courseName;
                    let foundCourse = null;
                    if (user.courseId) foundCourse = await Course.findOne({ courseId: user.courseId });
                    if (!foundCourse && user.courseName) {
                        foundCourse = await Course.findOne({ $or: [{ title: user.courseName }, { name: user.courseName }] });
                    }
                    if (foundCourse) {
                        if (total === 0) total = foundCourse.amount;
                        if (!courseName || courseName === "N/A") courseName = foundCourse.title;
                    } else if (user.courseName) {
                        // 3. Fallback to Category-based lookup (for students whose course isn't in main list)
                        const CourseCategory = require("../models/CourseCategory");
                        const category = await CourseCategory.findOne({ name: user.courseName });
                        if (category && total === 0) total = category.fees || 0;
                    }
                }
            }

            const paid = p.paidAmount || 0;
            const remaining = Math.max(0, total - paid);

            return {
                _id: p.userId?._id || p._id,
                paymentId: p._id,
                name: p.userId?.name || 'Unknown',
                course: courseName,
                duration: p.durationInDays || 90,
                totalFees: total, 
                paidAmount: paid,
                pendingAmount: remaining,
                status: remaining <= 0 ? "paid" : (paid > 0 ? "partial" : "pending"),
                method: p.transactions.length > 0 ? p.transactions[p.transactions.length - 1].method : 'N/A',
                date: p.createdAt 
            };
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
