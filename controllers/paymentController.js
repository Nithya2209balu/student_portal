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
            .populate("courseId", "title isActive amount")
            .sort({ createdAt: -1 });

        if (!payment) {
            // New fallback: Fetch from User -> Course
            const user = await User.findById(userId).select("courseId courseName");
            if (user) {
                let totalFees = 0;
                let courseName = user.courseName || "N/A";

                if (user.courseId || courseName !== "N/A") {
                    const Course = require("../models/Course");
                    const CourseCategory = require("../models/CourseCategory");
                    let doc = null;
                    if (user.courseId) {
                        doc = await Course.findOne({ courseId: user.courseId });
                        if (!doc) doc = await CourseCategory.findOne({ courseId: user.courseId });
                    }
                    if (!doc && courseName !== "N/A") {
                        doc = await Course.findOne({ title: courseName });
                        if (!doc) doc = await CourseCategory.findOne({ name: courseName });
                    }

                    if (doc) {
                        totalFees = doc.amount || doc.fees || 0;
                        courseName = doc.title || doc.name || courseName;
                    }
                }

                if (totalFees > 0 || courseName !== "N/A") {
                    return res.json({
                        success: true,
                        data: {
                            totalFees,
                            paidAmount: 0,
                            remainingAmount: totalFees,
                            status: "pending",
                            courseName,
                            nextInstallmentDate: (() => {
                                const d = new Date();
                                d.setMonth(d.getMonth() + 1);
                                d.setDate(10);
                                d.setHours(0, 0, 0, 0);
                                return d;
                            })()
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

        // Calculate next installment date: 10th of the next month
        const nextInstallmentDate = new Date(today);
        nextInstallmentDate.setMonth(nextInstallmentDate.getMonth() + 1);
        nextInstallmentDate.setDate(10);
        nextInstallmentDate.setHours(0, 0, 0, 0);

        // 🔹 Self-heal totalFees and courseName if they are missing or 0
        let totalFees = payment.totalFees || 0;
        let courseName = payment.courseId?.title || payment.courseId?.name || "N/A";

        if (totalFees === 0 || courseName === "N/A") {
            // First check the populated object (if any)
            if (payment.courseId) {
                if (totalFees === 0) totalFees = payment.courseId.amount || payment.courseId.fees || 0;
                if (courseName === "N/A") courseName = payment.courseId.title || payment.courseId.name || "N/A";
            }
            
            // Second layer of self-heal using database lookups (Course or CourseCategory)
            if (totalFees === 0 || courseName === "N/A") {
                const user = await User.findById(userId).select("courseId courseName");
                const Course = require("../models/Course");
                const CourseCategory = require("../models/CourseCategory");

                // 1. Try by ObjectId from payment record (it might be a Course or a Category)
                if (payment.courseId && typeof payment.courseId === "object") {
                   const refId = payment.courseId._id || payment.courseId;
                   let refDoc = await Course.findById(refId);
                   if (!refDoc) refDoc = await CourseCategory.findById(refId);
                   
                   if (refDoc) {
                       if (totalFees === 0) totalFees = refDoc.amount || refDoc.fees || 0;
                       if (courseName === "N/A") courseName = refDoc.title || refDoc.name || "N/A";
                   }
                }

                // 2. Try by User's numeric courseId or title
                if (totalFees === 0 || courseName === "N/A") {
                    if (user) {
                        let doc = null;
                        if (user.courseId) {
                            doc = await Course.findOne({ courseId: user.courseId });
                            if (!doc) doc = await CourseCategory.findOne({ courseId: user.courseId });
                        }
                        if (!doc && user.courseName) {
                            doc = await Course.findOne({ title: user.courseName });
                            if (!doc) doc = await CourseCategory.findOne({ name: user.courseName });
                        }

                        if (doc) {
                            if (totalFees === 0) totalFees = doc.amount || doc.fees || 0;
                            if (courseName === "N/A") courseName = doc.title || doc.name || "N/A";
                        }
                    }
                }
            }
        }

        const remainingAmount = Math.max(0, totalFees - payment.paidAmount);

        res.json({
            success: true,
            data: {
                totalFees,
                paidAmount: payment.paidAmount,
                remainingAmount,
                daysLeft,
                status: payment.status,
                courseName,
                nextInstallmentDate,
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

        let cumulativePaid = 0;
        const transactions = payment.transactions.map(tx => {
            cumulativePaid += tx.amount;
            return {
                _id: tx._id,
                transactionId: tx._id,
                paymentId: payment._id,
                date: tx.date,
                method: tx.method,
                paymentType: tx.paymentType || "MANUAL",
                installmentNumber: tx.installmentNumber,
                type: tx.type || "Installment",
                receiptId: tx.receiptId || `REC-${Math.floor(1000 + Math.random() * 9000)}`,
                status: tx.status || "success",
                courseName: dynamicCourseTitle,
                totalAmount: dynamicFees,
                paidAmount: tx.amount,
                pendingAmount: Math.max(0, dynamicFees - cumulativePaid)
            };
        });

        res.json({
            success: true,
            transactions: transactions.reverse(),
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

        const doc = new PDFDocument({ margin: 50, size: "A4" });
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename=receipt_${tx.receiptId || transactionId}.pdf`);

        doc.pipe(res);

        // --- PATHS ---
        const path = require("path");
        const logoPath = path.join(__dirname, "../uploads/categories/by8labs_logo.png");
        const fs = require("fs");

        // --- 🔹 DYNAMIC DATA HEALING ---
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

        // --- 🔹 WATERMARK ---
        if (fs.existsSync(logoPath)) {
            doc.save();
            doc.opacity(0.04);
            doc.image(logoPath, 150, 250, { width: 300 });
            doc.restore();
        }

        // --- 🔹 UI COLORS ---
        const primaryColor = "#1A237E";
        const secondaryColor = "#303F9F";
        const accentColor = "#B71C1C";
        const textColor = "#333333";
        const labelColor = "#666666";

        // --- 🔹 HEADER AREA ---
        // Top Border / Bar
        doc.rect(0, 0, 595, 120).fill("#F5F5F5");
        doc.rect(50, 118, 495, 2).fill(primaryColor);

        if (fs.existsSync(logoPath)) {
            doc.image(logoPath, 50, 30, { width: 60 });
        }
        
        doc.fillColor(primaryColor).fontSize(24).font("Helvetica-Bold")
            .text("BY8LABS", 125, 40);
        
        doc.fillColor(labelColor).fontSize(10).font("Helvetica")
            .text("Technology Learning & Innovation Center", 125, 68);

        doc.fillColor(textColor).fontSize(14).font("Helvetica-Bold")
            .text("PAYMENT RECEIPT", 400, 45, { align: "right" });
        
        doc.fillColor(labelColor).fontSize(9).font("Helvetica")
            .text(`Date: ${tx.date.toLocaleDateString()}`, 400, 65, { align: "right" })
            .text(`Receipt #: ${tx.receiptId || "N/A"}`, 400, 78, { align: "right" });

        doc.moveDown(4);

        // --- 🔹 INFO GRID ---
        const gridTop = 150;
        
        // Left Column: Student Info
        doc.fillColor(primaryColor).fontSize(11).font("Helvetica-Bold").text("BILL TO:", 50, gridTop);
        doc.fillColor(textColor).fontSize(12).font("Helvetica-Bold").text(payment.userId.name.toUpperCase(), 50, gridTop + 18);
        doc.fillColor(textColor).fontSize(10).font("Helvetica")
            .text(`Email: ${payment.userId.email}`, 50, gridTop + 35)
            .text(`Course: ${courseName}`, 50, gridTop + 50);

        // Right Column: Payment Info
        doc.fillColor(primaryColor).fontSize(11).font("Helvetica-Bold").text("PAYMENT STATUS:", 350, gridTop);
        const status = remaining <= 0 ? "FULLY PAID" : (payment.paidAmount > 0 ? "PARTIALLY PAID" : "PENDING");
        doc.fillColor(remaining <= 0 ? "#2E7D32" : accentColor).fontSize(12).font("Helvetica-Bold").text(status, 350, gridTop + 18);
        doc.fillColor(textColor).fontSize(10).font("Helvetica")
            .text(`Payment Mode: ${tx.method?.toUpperCase() || "CASH"}`, 350, gridTop + 35);

        doc.moveDown(3);

        // --- 🔹 TRANSACTION TABLE ---
        const tableTop = 260;
        doc.rect(50, tableTop, 495, 25).fill(primaryColor);
        doc.fillColor("#FFFFFF").fontSize(10).font("Helvetica-Bold")
            .text("DESCRIPTION", 65, tableTop + 8)
            .text("CATEGORY", 250, tableTop + 8)
            .text("AMOUNT", 450, tableTop + 8, { align: "right", width: 80 });

        doc.fillColor(textColor).fontSize(10).font("Helvetica")
            .text(tx.type || "Installment Payment", 65, tableTop + 40)
            .text("Academic Fees", 250, tableTop + 40)
            .font("Helvetica-Bold").text(`Rs. ${tx.amount.toLocaleString()}`, 450, tableTop + 40, { align: "right", width: 80 });

        doc.rect(50, tableTop + 65, 495, 1).fill("#EEEEEE");

        // --- 🔹 SUMMARY SECTION ---
        const summaryTop = tableTop + 100;
        
        doc.fillColor(labelColor).fontSize(10).font("Helvetica")
            .text("Total Course Fees:", 350, summaryTop)
            .text("Total Amount Paid:", 350, summaryTop + 20);
        
        doc.fillColor(textColor).fontSize(10).font("Helvetica-Bold")
            .text(`Rs. ${totalFees.toLocaleString()}`, 465, summaryTop, { align: "right", width: 80 })
            .text(`Rs. ${payment.paidAmount.toLocaleString()}`, 465, summaryTop + 20, { align: "right", width: 80 });

        doc.rect(350, summaryTop + 40, 200, 1).fill(primaryColor);

        doc.fillColor(accentColor).fontSize(14).font("Helvetica-Bold")
            .text("BALANCE DUE:", 350, summaryTop + 52)
            .text(`Rs. ${remaining.toLocaleString()}`, 465, summaryTop + 52, { align: "right", width: 80 });

        // --- 🔹 PAID STAMP ---
        if (remaining <= 0) {
            doc.save();
            doc.rotate(-30, { origin: [300, 450] });
            doc.rect(230, 420, 140, 60).lineWidth(3).stroke("#2E7D32");
            doc.fillColor("#2E7D32").fontSize(35).font("Helvetica-Bold").opacity(0.2)
                .text("PAID", 255, 430);
            doc.restore();
        }

        // --- 🔹 FOOTER ---
        const footerY = 750;
        doc.rect(50, footerY - 10, 495, 1).fill("#EEEEEE");
        doc.fillColor(labelColor).fontSize(8).font("Helvetica")
            .text("Note: This is a computer-generated receipt and does not require a physical signature.", 50, footerY, { align: "center", width: 495 })
            .text("BY8LABS | Technology Learning & Innovation Center", 50, footerY + 12, { align: "center", width: 495 });

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

        const doc = new PDFDocument({ margin: 50, size: "A4" });
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename=payslip_${userId}.pdf`);

        doc.pipe(res);

        // --- PATHS ---
        const path = require("path");
        const logoPath = path.join(__dirname, "../uploads/categories/by8labs_logo.png");
        const fs = require("fs");

        const primaryColor = "#1A237E";
        const textColor = "#333333";
        const labelColor = "#666666";

        // --- 🔹 HEADER ---
        doc.rect(0, 0, 595, 100).fill("#F5F5F5");
        if (fs.existsSync(logoPath)) {
            doc.image(logoPath, 50, 25, { width: 50 });
        }
        doc.fillColor(primaryColor).fontSize(20).font("Helvetica-Bold")
            .text("BY8LABS", 110, 30);
        doc.fillColor(labelColor).fontSize(14).font("Helvetica")
            .text("PAYMENT SUMMARY PAYSLIP", 110, 55);
        
        doc.fillColor(textColor).fontSize(10).font("Helvetica")
            .text(`Generated on: ${new Date().toLocaleDateString()}`, 400, 45, { align: "right" });

        doc.moveDown(4);

        // --- 🔹 STUDENT INFO ---
        const infoTop = 130;
        doc.fillColor(primaryColor).fontSize(11).font("Helvetica-Bold").text("STUDENT DETAILS", 50, infoTop);
        doc.rect(50, infoTop + 15, 495, 1).fill("#EEEEEE");

        // --- 🔹 DYNAMIC DATA HEALING FOR COURSE NAME ---
        let courseName = payment.courseId?.title || payment.courseId?.name || "N/A";
        if (courseName === "N/A") {
            const user = await User.findById(payment.userId).select("courseName courseId");
            if (user) {
                courseName = user.courseName || "N/A";
                if (courseName === "N/A" && user.courseId) {
                    const Course = require("../models/Course");
                    const foundCourse = await Course.findOne({ courseId: user.courseId });
                    if (foundCourse) courseName = foundCourse.title || foundCourse.name;
                }
            }
        }

        doc.fillColor(textColor).fontSize(10).font("Helvetica")
            .text("Name:", 50, infoTop + 30)
            .font("Helvetica-Bold").text(payment.userId.name, 150, infoTop + 30)
            .font("Helvetica").text("Course:", 50, infoTop + 45)
            .font("Helvetica-Bold").text(courseName, 150, infoTop + 45)
            .font("Helvetica").text("Email:", 50, infoTop + 60)
            .font("Helvetica-Bold").text(payment.userId.email, 150, infoTop + 60);

        // --- 🔹 FINANCIAL SUMMARY ---
        const summaryTop = infoTop + 100;
        doc.fillColor(primaryColor).fontSize(11).font("Helvetica-Bold").text("FINANCIAL SUMMARY", 50, summaryTop);
        doc.rect(50, summaryTop + 15, 495, 1).fill("#EEEEEE");

        const col1 = 50, col2 = 180, col3 = 330, col4 = 460;
        doc.fillColor(labelColor).fontSize(9).font("Helvetica")
            .text("TOTAL FEES", col1, summaryTop + 30)
            .text("TOTAL PAID", col2, summaryTop + 30)
            .text("REMAINING", col3, summaryTop + 30)
            .text("STATUS", col4, summaryTop + 30);

        doc.fillColor(textColor).fontSize(12).font("Helvetica-Bold")
            .text(`Rs. ${payment.totalFees.toLocaleString()}`, col1, summaryTop + 45)
            .text(`Rs. ${payment.paidAmount.toLocaleString()}`, col2, summaryTop + 45)
            .fillColor("#B71C1C").text(`Rs. ${payment.remainingAmount.toLocaleString()}`, col3, summaryTop + 45)
            .fillColor(payment.status === "paid" ? "#2E7D32" : primaryColor).text(payment.status.toUpperCase(), col4, summaryTop + 45);

        // --- 🔹 TRANSACTION HISTORY ---
        const historyTop = summaryTop + 100;
        doc.fillColor(primaryColor).fontSize(11).font("Helvetica-Bold").text("TRANSACTION HISTORY", 50, historyTop);
        
        doc.rect(50, historyTop + 18, 495, 20).fill("#F0F0F0");
        doc.fillColor(primaryColor).fontSize(9).font("Helvetica-Bold")
            .text("#", 60, historyTop + 24)
            .text("DATE", 90, historyTop + 24)
            .text("TYPE", 180, historyTop + 24)
            .text("METHOD", 280, historyTop + 24)
            .text("PAY TYPE", 370, historyTop + 24)
            .text("AMOUNT", 450, historyTop + 24, { align: "right", width: 80 });

        let currentY = historyTop + 45;
        payment.transactions.forEach((tx, index) => {
            doc.fillColor(textColor).fontSize(9).font("Helvetica")
                .text(tx.installmentNumber || index + 1, 60, currentY)
                .text(new Date(tx.date).toLocaleDateString(), 90, currentY)
                .text(tx.type || "Installment", 180, currentY)
                .text(tx.method?.toUpperCase() || "N/A", 280, currentY)
                .text(tx.paymentType || "MANUAL", 370, currentY)
                .font("Helvetica-Bold").text(`Rs. ${tx.amount.toLocaleString()}`, 450, currentY, { align: "right", width: 80 });
            
            doc.rect(50, currentY + 12, 495, 0.5).fill("#EEEEEE");
            currentY += 22;
        });

        // --- 🔹 FOOTER ---
        doc.fillColor(labelColor).fontSize(8).font("Helvetica")
            .text("This is an official payment payslip issued by BY8LABS. For any discrepancies, please contact support.", 50, 750, { align: "center", width: 495 });

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

        // 1. Find existing payment record
        // Try exact match with normalized course ID first
        let payment = await Payment.findOne({ userId, courseId: normalizedCourseId });
        
        // If not found, fall back to any existing payment record for this user 
        // (to unify records even if course IDs differ slightly)
        if (!payment) {
             payment = await Payment.findOne({ userId }).sort({ createdAt: -1 });
        }

        if (!payment) {
            // --- NEW PAYMENT RECORD ---
            let courseAmount = 0;
            if (normalizedCourseId && mongoose.Types.ObjectId.isValid(normalizedCourseId)) {
                const course = await Course.findById(normalizedCourseId);
                if (course) courseAmount = course.amount;
            }

            const nextInstallment = new Date();
            nextInstallment.setDate(nextInstallment.getDate() + 30);

            const duration = 90;
            const endDate = new Date();
            endDate.setDate(endDate.getDate() + duration);

            payment = new Payment({
                userId,
                courseId: normalizedCourseId || courseId, // Prefer normalized
                totalFees: courseAmount || totalFees,
                paidAmount: numAmount,
                remainingAmount: Math.max(0, (courseAmount || totalFees) - numAmount),
                durationInDays: duration,
                endDate,
                nextInstallmentDate: nextInstallment,
                transactions: [{
                    amount: numAmount,
                    method,
                    paymentType: "MANUAL",
                    installmentNumber: 1,
                    collectedBy,
                    type: type || "Admission Fee",
                    receiptId,
                    status: "success",
                    date: new Date()
                }],
            });
        } else {
            // --- UPDATING EXISTING RECORD ---
            payment.paidAmount += numAmount;
            payment.remainingAmount = Math.max(0, payment.totalFees - payment.paidAmount);

            const nextInstallment = new Date();
            nextInstallment.setDate(nextInstallment.getDate() + 30);
            payment.nextInstallmentDate = nextInstallment;

            // Determine installment number globally for the user
            const allUserPayments = await Payment.find({ userId });
            let totalTransactionsCount = 0;
            allUserPayments.forEach(p => {
                totalTransactionsCount += (p.transactions ? p.transactions.length : 0);
            });
            const globalInstallmentNumber = totalTransactionsCount + 1;

            payment.transactions.push({
                amount: numAmount,
                method,
                paymentType: "MANUAL",
                installmentNumber: globalInstallmentNumber,
                collectedBy,
                type: type || `Installment ${globalInstallmentNumber}`,
                receiptId,
                status: "success",
                date: new Date()
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
        console.error("Error in addManualPayment:", err.message);
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
        const paidAmount = existingPayment ? existingPayment.paidAmount : 0;

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
