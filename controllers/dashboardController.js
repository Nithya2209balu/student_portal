const Enrollment = require("../models/Enrollment");
const Attendance = require("../models/Attendance");

/**
 * GET /api/dashboard/counts
 * Returns: totalClasses, avgAttendancePercent, currentClassCount
 */
exports.getDashboardCounts = async (req, res, next) => {
    try {
        const userId = req.user.id;

        // Total enrolled courses = total classes
        const totalClasses = await Enrollment.countDocuments({
            userId,
            paymentStatus: "paid",
        });

        // Attendance stats
        const attendanceRecords = await Attendance.find({ userId });
        const presentCount = attendanceRecords.filter((r) => r.status === "present").length;
        const totalRecords = attendanceRecords.filter(
            (r) => r.status === "present" || r.status === "absent"
        ).length;

        const avgAttendancePercent =
            totalRecords > 0 ? Math.round((presentCount / totalRecords) * 100) : 0;

        // Current active class count (same as enrolled for now; can be filtered by schedule)
        const currentClassCount = totalClasses;

        res.json({
            success: true,
            data: {
                "total classes": totalClasses,
                "Average attendance percentage": avgAttendancePercent,
                "current class count": currentClassCount,
            },
        });
    } catch (err) {
        next(err);
    }
};
