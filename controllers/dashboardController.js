const User = require("../models/User");
const CourseCategory = require("../models/CourseCategory");
const Attendance = require("../models/Attendance");

// Shared helper: compute dashboard stats for a given userId
const computeDashboard = async (userId) => {
    // 1. Fetch student to get courseId
    const student = await User.findById(userId);
    if (!student) throw new Error("Student not found");

    // 2. Fetch course category to get duration in months
    let duration = 0;
    if (student.courseId) {
        const category = await CourseCategory.findOne({ courseId: student.courseId });
        if (category && category.duration) {
            duration = category.duration;
        }
    }

    // 3. Convert Duration (months to days)
    const totalClasses = duration * 30;

    // 4. Calculate Attendance
    const attendanceRecords = await Attendance.find({ userId });
    const attendedClasses = attendanceRecords.filter((r) => r.status === "present").length;
    
    // 5. Optionally compute percentage
    const attendancePercentage = totalClasses > 0 ? Math.round((attendedClasses / totalClasses) * 100) : 0;

    return {
        totalClasses,
        attendedClasses,
        attendancePercentage,
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

/**
 * GET /api/dashboard/admin/attendance
 * Admin only - Returns overall attendance stats across ALL students
 */
exports.getAdminAttendanceDashboard = async (req, res, next) => {
    try {
        const records = await Attendance.find();
        
        const presentCount = records.filter(r => r.status === "present").length;
        const absentCount = records.filter(r => r.status === "absent").length;
        const holidayCount = records.filter(r => r.status === "holiday").length;
        
        const workingDays = presentCount + absentCount;
        const attendancePercentage = workingDays > 0 ? Math.round((presentCount / workingDays) * 100) : 0;

        res.json({
            success: true,
            data: {
                totalDays: records.length,          // 📊 Total Attendance Records
                presentCount,                       // ✅ Present Count
                absentCount,                        // ❌ Absent Count
                holidayCount,                       // 🏖️ Holiday Count
                attendancePercentage                // 📈 Attendance %
            }
        });
    } catch (err) {
        next(err);
    }
};
