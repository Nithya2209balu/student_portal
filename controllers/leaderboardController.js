const QuizScore = require("../models/QuizScore");
const User = require("../models/User");

/**
 * GET /api/leaderboard
 * Returns students ranked by total quiz score (desc)
 */
exports.getLeaderboard = async (req, res, next) => {
    try {
        const scores = await QuizScore.aggregate([
            {
                $group: {
                    _id: "$userId",
                    totalScore: { $sum: "$score" },
                    totalQuizzes: { $sum: 1 },
                },
            },
            { $sort: { totalScore: -1 } },
            { $limit: 50 },
            {
                $lookup: {
                    from: "users",
                    localField: "_id",
                    foreignField: "_id",
                    as: "user",
                },
            },
            { $unwind: "$user" },
            {
                $project: {
                    _id: 0,
                    userId: "$_id",
                    name: "$user.name",
                    email: "$user.email",
                    totalScore: 1,
                    totalQuizzes: 1,
                },
            },
        ]);

        // Add rank
        const ranked = scores.map((entry, index) => ({
            rank: index + 1,
            ...entry,
        }));

        res.json({ success: true, data: ranked });
    } catch (err) {
        next(err);
    }
};
