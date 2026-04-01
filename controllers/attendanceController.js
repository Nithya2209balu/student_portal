const Attendance = require("../models/Attendance");

// ── Shared helpers ─────────────────────────────────────────────────────────


const User = require("../models/User");

const generateOTP = () => Math.floor(1000 + Math.random() * 9000).toString();
const sendOTPEmail = async (email, otp) => {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
            "api-key": process.env.BREVO_API_KEY,
            "content-type": "application/json",
            "accept": "application/json"
        },
        body: JSON.stringify({
            sender: { name: "HR System", email: process.env.BREVO_FROM_EMAIL },
            to: [{ email }],
            subject: "Attendance Edit Verification OTP",
            htmlContent: `<p>An HR admin is trying to edit an attendance record.</p><p>Your verification OTP is <strong>${otp}</strong>.</p><p>It expires in 10 minutes.</p>`
        })
    });
    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || "Failed to send OTP email");
    }
};

const computeSummary = async (userId) => {
    const records = await Attendance.find({ userId });
    const presentCount = records.filter((r) => r.status === "present").length;
    const absentCount = records.filter((r) => r.status === "absent").length;
    const holidayCount = records.filter((r) => r.status === "holiday").length;
    const workingDays = presentCount + absentCount;
    const percentage = workingDays > 0 ? Math.round((presentCount / workingDays) * 100) : 0;
    return {
        totalDays: records.length,
        presentCount,
        absentCount,
        holidayCount,
        attendancePercentage: percentage,
    };
};

const computeList = async (userId, startDate, endDate, dateParam, monthParam) => {
    const filter = { userId };
    if (monthParam) {
        filter.date = {};
        const [year, month] = monthParam.split("-");
        const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
        const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
        filter.date.$gte = start;
        filter.date.$lte = end;
    } else if (dateParam) {
        filter.date = {};
        const start = new Date(dateParam);
        start.setUTCHours(0, 0, 0, 0);
        const end = new Date(dateParam);
        end.setUTCHours(23, 59, 59, 999);
        filter.date.$gte = start;
        filter.date.$lte = end;
    } else if (startDate || endDate) {
        filter.date = {};
        if (startDate) filter.date.$gte = new Date(startDate);
        if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            filter.date.$lte = end;
        }
    }
    return Attendance.find(filter).sort({ date: -1 });
};

// ── Without ID (uses JWT token) ────────────────────────────────────────────

/**
 * GET /api/attendance/summary
 */
exports.getAttendanceSummary = async (req, res, next) => {
    try {
        const data = await computeSummary(req.user.id);
        res.json({ success: true, data });
    } catch (err) {
        next(err);
    }
};

/**
 * GET /api/attendance?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 */
exports.getAttendanceList = async (req, res, next) => {
    try {
        const { startDate, endDate, date, month } = req.query;
        const records = await computeList(req.user.id, startDate, endDate, date, month);
        res.json({ success: true, total: records.length, data: records });
    } catch (err) {
        next(err);
    }
};

// ── With ID ────────────────────────────────────────────────────────────────

/**
 * GET /api/attendance/summary/:userId
 */
exports.getAttendanceSummaryById = async (req, res, next) => {
    try {
        const data = await computeSummary(req.params.userId);
        res.json({ success: true, data });
    } catch (err) {
        next(err);
    }
};

/**
 * GET /api/attendance/:userId?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 */
exports.getAttendanceListById = async (req, res, next) => {
    try {
        const { startDate, endDate, date, month } = req.query;
        const records = await computeList(req.params.userId, startDate, endDate, date, month);
        res.json({ success: true, total: records.length, data: records });
    } catch (err) {
        next(err);
    }
};

/**
 * POST /api/attendance/:userId
 * Mark or update attendance for a specific student
 * Body: { date (YYYY-MM-DD), status (present, absent, holiday), courseId (optional), remarks (optional) }
 */
exports.markAttendanceById = async (req, res, next) => {
    try {
        const { date, remarks } = req.body;
        const courseId = req.body.courseId ? Number(req.body.courseId) : null;
        let { status } = req.body;
        const userId = req.params.userId;

        if (!date || !status) {
            return res.status(400).json({ success: false, message: "Date and status are required" });
        }

        status = status.toLowerCase();

        if (!["present", "absent", "holiday"].includes(status)) {
            return res.status(400).json({ success: false, message: "Invalid status value. Must be present, absent, or holiday." });
        }

        // Set time to start of day for strict unique indexing
                // Date restriction: Only allow today
        const inputDate = new Date(date);
        const today = new Date();
        const inputUTC = Date.UTC(inputDate.getUTCFullYear(), inputDate.getUTCMonth(), inputDate.getUTCDate());
        const todayUTC = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
        
        if (inputUTC !== todayUTC) {
            return res.status(400).json({ success: false, message: "Attendance can only be marked for today's date." });
        }

        const recordDate = new Date(inputUTC);
        const filter = { userId, date: recordDate };
        if (courseId) filter.courseId = courseId; 

        const existing = await Attendance.findOne(filter);
        if (existing) {
            return res.status(400).json({ success: false, message: "Attendance already marked for today. To edit attendance, use the HR verification 'request-edit' endpoint." });
        }

        const record = await Attendance.create({
            userId,
            courseId: courseId || null,
            date: recordDate,
            status: status.toLowerCase(),
            remarks: remarks || "",
        });

        res.status(201).json({ success: true, message: "Attendance marked successfully", data: record });
    } catch (err) {
        next(err);
    }
};

/**
 * POST /api/attendance/:userId/request-edit
 */
exports.requestAttendanceEditById = async (req, res, next) => {
    try {
        const { date } = req.body;
        const courseId = req.body.courseId ? Number(req.body.courseId) : null;
        if (!date) return res.status(400).json({ success: false, message: "Date is required" });

        const inputDate = new Date(date);
        const today = new Date();
        const inputUTC = Date.UTC(inputDate.getUTCFullYear(), inputDate.getUTCMonth(), inputDate.getUTCDate());
        const todayUTC = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());

        if (inputUTC !== todayUTC) {
            return res.status(400).json({ success: false, message: "Attendance can only be edited for today's date." });
        }

        const recordDate = new Date(inputUTC);
        const filter = { userId: req.params.userId, date: recordDate };
        if (courseId) filter.courseId = courseId;
        
        const existing = await Attendance.findOne(filter);
        if (!existing) {
            return res.status(400).json({ success: false, message: "No attendance found for today to edit. Just use the standard mark API." });
        }

        const otp = generateOTP();
        await User.findByIdAndUpdate(req.user.id, {
            otp,
            otpExpiry: Date.now() + 10 * 60 * 1000
        });

        await sendOTPEmail("hr@by8labs.com", otp);

        res.json({ success: true, message: "Verification OTP sent to hr@by8labs.com" });
    } catch (err) { next(err); }
};

/**
 * PUT /api/attendance/:userId/verify-edit
 */
exports.verifyAttendanceEditById = async (req, res, next) => {
    try {
        const { otp, date, status, remarks } = req.body;
        const courseId = req.body.courseId ? Number(req.body.courseId) : null;
        if (!otp || !date || !status) return res.status(400).json({ success: false, message: "OTP, date, and new status are required" });

        const adminUser = await User.findById(req.user.id);
        if (!adminUser.otp || adminUser.otp !== otp || adminUser.otpExpiry < Date.now()) {
            return res.status(400).json({ success: false, message: "Invalid or expired OTP" });
        }

        adminUser.otp = undefined;
        adminUser.otpExpiry = undefined;
        await adminUser.save();

        const inputDate = new Date(date);
        const inputUTC = Date.UTC(inputDate.getUTCFullYear(), inputDate.getUTCMonth(), inputDate.getUTCDate());
        const recordDate = new Date(inputUTC);

        const filter = { userId: req.params.userId, date: recordDate };
        if (courseId) filter.courseId = courseId;

        const record = await Attendance.findOneAndUpdate(
            filter,
            { status: status.toLowerCase(), remarks: remarks || "" },
            { new: true }
        );

        if (!record) return res.status(400).json({ success: false, message: "Attendance record not found to edit" });

        res.json({ success: true, message: "Attendance edited successfully", data: record });
    } catch (err) { next(err); }
};

/**
 * 🔹 GET /api/attendance/progress/:userId
 * Fetch: totalDurationDays (assumed 90), attendedDays, totalHours, attendedHours, progressPercentage, and points.
 */
exports.getAttendanceProgress = async (req, res, next) => {
    try {
        const { userId } = req.params;

        // Fetch user from DB to confirm existing
        const userFound = await User.findById(userId);
        if (!userFound) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        // Count 'present' records for this user
        const attendedDays = await Attendance.countDocuments({
            userId,
            status: "present"
        });

        const totalDurationDays = 90; // Default requirement
        const totalHours = totalDurationDays * 2; // 1 day = 2 hours class
        const attendedHours = attendedDays * 2;
        const points = Math.round((attendedDays / totalDurationDays) * 100);

        res.json({
            success: true,
            data: {
                totalDurationDays,
                attendedDays,
                totalHours,
                attendedHours,
                points
            }
        });
    } catch (err) {
        next(err);
    }
};
