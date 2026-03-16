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

/**
 * POST /api/attendance/:userId
 * Mark or update attendance for a specific student
 * Body: { date (YYYY-MM-DD), status (present, absent, holiday), courseId (optional), remarks (optional) }
 */
exports.markAttendanceById = async (req, res, next) => {
    try {
        const { date, courseId, remarks } = req.body;
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
        const recordDate = new Date(date);
        recordDate.setUTCHours(0, 0, 0, 0);

        const filter = { userId, date: recordDate };
        if (courseId) filter.courseId = courseId; // only apply course constraint if provided

        // Find existing record and update, or create a new one (upsert: true)
        const record = await Attendance.findOneAndUpdate(
            filter,
            { status, remarks },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );

        res.status(200).json({ success: true, message: "Attendance marked successfully", data: record });
    } catch (err) {
        next(err);
    }
};
