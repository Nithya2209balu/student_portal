const cron = require("node-cron");
const User = require("../models/User");
const Notification = require("../models/Notification");
const { sendPushNotifications } = require("./notifications");

/**
 * Scheduled Jobs
 */
const initCronJobs = () => {
    const sendTestNotification = async (reason = "Scheduled 5m") => {
        try {
            console.log(`🕒 Automated Job [${reason}]: Sending test notification...`);

            // Fetch all users with a valid FCM token
            const users = await User.find({ fcmToken: { $exists: true, $ne: "" } }).select("fcmToken name");
            const targetTokens = users.map(u => u.fcmToken);

            if (targetTokens.length === 0) {
                console.log(`⚠️ Automated Job [${reason}]: No FCM token s found to notify.`);
                return;
            }

            const title = "Automated Test 🔔";
            const message = `Test notification [${reason}] sent at ${new Date().toLocaleTimeString()} for testing purposes.`;

            // Trigger Push Notification
            await sendPushNotifications(targetTokens, title, message);

            // Save to Notification History
            await Notification.create({
                title,
                message,
                targetAll: true,
                userId: null
            });

            console.log(`✅ Automated Job [${reason}]: Test notification sent to ${targetTokens.length} users.`);
        } catch (err) {
            console.error(`❌ Automated Job [${reason}] Error:`, err.message);
        }
    };

    // Run once immediately on start for testing
    sendTestNotification("Server Start");

    // 1. Every 5 Minutes (Continuous)
    cron.schedule("*/5 * * * *", () => sendTestNotification("Scheduled 5m"));

    console.log("✅ Cron Jobs initialized (Immediate + 5-minute continuous test notification)");
};

module.exports = { initCronJobs };
