const Attendance = require("../models/Attendance");

/**
 * GET /api/attendance/summary
 * Returns overall %, present, absent, holiday counts
 */
exports.getAttendanceSummary = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const records = await Attendance.find({ userId });

        const presentCount = records.filter((r) => r.status === "present").length;
        const absentCount = records.filter((r) => r.status === "absent").length;
        const holidayCount = records.filter((r) => r.status === "holiday").length;
        const workingDays = presentCount + absentCount;
        const percentage = workingDays > 0 ? Math.round((presentCount / workingDays) * 100) : 0;

        res.json({
            success: true,
            data: {
                totalDays: records.length,
                presentCount,
                absentCount,
                holidayCount,
                attendancePercentage: percentage,
            },
        });
    } catch (err) {
        next(err);
    }
};

/**
 * GET /api/attendance?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 * Returns date-filtered attendance list
 */
exports.getAttendanceList = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { startDate, endDate } = req.query;

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

        const records = await Attendance.find(filter)
            .populate("courseId", "title")
            .sort({ date: -1 });

        res.json({ success: true, total: records.length, data: records });
    } catch (err) {
        next(err);
    }
};
