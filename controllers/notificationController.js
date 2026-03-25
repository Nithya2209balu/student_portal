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
            .select("-updatedAt -__v")
            .sort({ createdAt: -1 })
            .limit(50);

        res.json({ success: true, data: notifications });
    } catch (err) {
        next(err);
    }
};

/**
 * GET /api/notifications/all
 * Admin only - fetch all notifications across the platform
 */
exports.getAllNotifications = async (req, res, next) => {
    try {
        const notifications = await Notification.find()
            .select("-updatedAt -__v")
            .sort({ createdAt: -1 })
            .limit(100);

        res.json({ success: true, total: notifications.length, data: notifications });
    } catch (err) {
        next(err);
    }
};
