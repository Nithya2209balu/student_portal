const Notification = require("../models/Notification");

/**
 * GET /api/notifications
 */
exports.getNotifications = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const notifications = await Notification.find({
            $or: [{ targetAll: true }, { userId }],
        })
            .sort({ createdAt: -1 })
            .limit(50);

        res.json({ success: true, data: notifications });
    } catch (err) {
        next(err);
    }
};
