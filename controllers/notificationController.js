const Notification = require("../models/Notification");
const User = require("../models/User");
const { sendPushNotifications } = require("../config/notifications");

/**
 * GET /api/notifications
 */
exports.getNotifications = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { unreadOnly } = req.query;
        
        const filter = {
            $or: [{ targetAll: true }, { userId }],
        };

        if (unreadOnly === "true") {
            filter.isRead = false;
        }

        const notifications = await Notification.find(filter)
            .select("-updatedAt -__v")
            .sort({ createdAt: -1 })
            .limit(50);

        res.json({ success: true, data: notifications });
    } catch (err) {
        next(err);
    }
};

/**
 * GET /api/notifications/user/:userId
 * Admin/System - fetch all notifications received by a specific user ID
 */
exports.getNotificationsByUserId = async (req, res, next) => {
    try {
        const { userId } = req.params;
        const notifications = await Notification.find({
            $or: [{ targetAll: true }, { userId }],
        })
            .select("-updatedAt -__v")
            .sort({ createdAt: -1 })
            .limit(50);

        res.json({ success: true, count: notifications.length, data: notifications });
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
        const { title, message, token, tokens: providedTokens, userId } = req.body;
        
        let targetTokens = [];

        // 1. If specific tokens are provided
        if (providedTokens && Array.isArray(providedTokens)) {
            targetTokens = providedTokens;
        } else if (token) {
            targetTokens = [token];
        } 
        // 2. If a specific userId is provided
        else if (userId) {
            const user = await User.findById(userId).select("fcmToken");
            if (user && user.fcmToken) {
                targetTokens = [user.fcmToken];
            }
        }
        // 3. Otherwise, fetch all users who have a token (Blast)
        else {
            const users = await User.find({ fcmToken: { $exists: true, $ne: "" } }).select("fcmToken");
            targetTokens = users.map(u => u.fcmToken);
        }

        if (targetTokens.length === 0) {
            return res.json({ success: false, message: "No target tokens found" });
        }

        console.log(`📡 Sending push notification to ${targetTokens.length} tokens...`);
        const response = await sendPushNotifications(targetTokens, title, message);

        // Save to notification history in DB
        await Notification.create({
            title: title || "Broadcast",
            message: message || "New announcement",
            targetAll: !userId && !token && !providedTokens,
            userId: userId || null
        });

        res.json({ success: true, targetCount: targetTokens.length, response });
    } catch (err) {
        next(err);
    }
};

/**
 * PATCH /api/notifications/:id/read
 * Mark a specific notification as read
 */
exports.markAsRead = async (req, res, next) => {
    try {
        const { id } = req.params;
        const notification = await Notification.findByIdAndUpdate(
            id,
            { isRead: true },
            { new: true }
        );

        if (!notification) {
            return res.status(404).json({ success: false, message: "Notification not found" });
        }

        res.json({ success: true, message: "Marked as read", data: notification });
    } catch (err) {
        next(err);
    }
};

/**
 * DELETE /api/notifications/:id
 * Delete a specific notification for the user
 */
exports.deleteNotification = async (req, res, next) => {
    try {
        const { id } = req.params;
        const notification = await Notification.findByIdAndDelete(id);

        if (!notification) {
            return res.status(404).json({ success: false, message: "Notification not found" });
        }

        res.json({ success: true, message: "Notification deleted" });
    } catch (err) {
        next(err);
    }
};
