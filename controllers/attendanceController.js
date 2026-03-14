const Attendance = require("../models/Attendance");

// ── Shared helpers ─────────────────────────────────────────────────────────

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

const computeList = async (userId, startDate, endDate) => {
    const filter = { userId };
    if (startDate || endDate) {
        filter.date = {};
        if (startDate) filter.date.$gte = new Date(startDate);
        if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            filter.date.$lte = end;
        }
    }
    return Attendance.find(filter).populate("courseId", "title").sort({ date: -1 });
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
        const { startDate, endDate } = req.query;
        const records = await computeList(req.user.id, startDate, endDate);
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
        const { startDate, endDate } = req.query;
        const records = await computeList(req.params.userId, startDate, endDate);
        res.json({ success: true, total: records.length, data: records });
    } catch (err) {
        next(err);
    }
};

