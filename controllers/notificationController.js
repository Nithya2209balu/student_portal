const Notification = require("../models/Notification");
const User = require("../models/User");
const { sendPushNotifications } = require("../config/notifications");

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

/**
 * POST /api/notifications/save-token
 * Public/User - Set/Update FCM/Expo token for the user
 */
exports.saveToken = async (req, res, next) => {  
    try {
        const token = req.body.token || req.body.fcmToken;
        if (!token) return res.status(400).json({ success: false, message: "Token required" });

        // If user is logged in (has req.user), save it to their profile strictly
        if (req.user) {
            const user = await User.findById(req.user.id);
            if (user) {
                user.fcmToken = token;
                await user.save();
            }
        }

        res.json({ success: true, message: "Token saved successfully" });
    } catch (err) {
        next(err);
    }
};

/**
 * POST /api/notifications/send-notification
 * Admin only - Send a push notification blast to all users
 */
exports.sendBulkNotification = async (req, res, next) => {
    try {
        const { title, message } = req.body;
        
        // Fetch all users who have a token
        const users = await User.find({ fcmToken: { $exists: true, $ne: "" } }).select("fcmToken");
        const tokens = users.map(u => u.fcmToken);

        if (tokens.length === 0) {
            console.warn("⚠️ Notification aborted: No user tokens found in database.");
            return res.json({ success: false, message: "No tokens available in database" });
        }

        console.log(`📡 Sending push notification to ${tokens.length} tokens...`);
        // Send push
        const response = await sendPushNotifications(tokens, title, message);

        // Save to notification history in DB as a "targetAll" notification
        await Notification.create({
            title: title || "Broadcast",
            message: message || "New announcement",
            targetAll: true
        });

        res.json({ success: true, response });
    } catch (err) {
        next(err);
    }
};
