const Enrollment = require("../models/Enrollment");
const Attendance = require("../models/Attendance");

// Shared helper: compute dashboard stats for a given userId
const computeDashboard = async (userId) => {
    const totalClasses = await Enrollment.countDocuments({
        userId,
        paymentStatus: "paid",
    });

    const attendanceRecords = await Attendance.find({ userId });
    const presentCount = attendanceRecords.filter((r) => r.status === "present").length;
    const totalRecords = attendanceRecords.filter(
        (r) => r.status === "present" || r.status === "absent"
    ).length;

    const avgAttendancePercent =
        totalRecords > 0 ? Math.round((presentCount / totalRecords) * 100) : 0;

    return {
        "total classes": totalClasses,
        "Average attendance percentage": avgAttendancePercent,
        "current class count": totalClasses,
    };
};

/**
 * GET /api/dashboard/counts
 * Uses the logged-in user's ID from JWT token.
 */
exports.getDashboardCounts = async (req, res, next) => {
    try {
        const data = await computeDashboard(req.user.id);
        res.json({ success: true, data });
    } catch (err) {
        next(err);
    }
};

/**
 * GET /api/dashboard/counts/:userId
 * Returns dashboard stats for the given student ID (Admin or self).
 */
exports.getDashboardCountsById = async (req, res, next) => {
    try {
        const data = await computeDashboard(req.params.userId);
        res.json({ success: true, data });
    } catch (err) {
        next(err);
    }
};
