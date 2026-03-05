const Enrollment = require("../models/Enrollment");

/**
 * GET /api/enrollments/my-courses
 */
exports.getMyCourses = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const enrollments = await Enrollment.find({ userId })
            .populate("courseId", "title imageUrl amount tutorName avgRating reviewsCount")
            .sort({ enrolledAt: -1 });

        res.json({ success: true, data: enrollments });
    } catch (err) {
        next(err);
    }
};
