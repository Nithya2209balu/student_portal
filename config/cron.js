const cron = require("node-cron");
const User = require("../models/User");
const Notification = require("../models/Notification");
const { sendPushNotifications } = require("./notifications");

/**
 * Scheduled Tasks
 */

// 1. Test Automated Notification for today at 2:30 PM (14:30)
// Format: minute hour day-of-month month day-of-week
cron.schedule("30 14 * * *", async () => {
    console.log("⏰ [CRON] Running scheduled test notification (2:30 PM)...");
    try {
        const title = "Test Automated Notification 2:30 PM";
        const message = "This is a scheduled test notification to verify the automation system.";

        // Fetch all users with a device token
        const users = await User.find({ fcmToken: { $exists: true, $ne: "" } }).select("fcmToken");
        const targetTokens = users.map(u => u.fcmToken);

        if (targetTokens.length > 0) {
            console.log(`📡 [CRON] Sending push to ${targetTokens.length} devices...`);
            await sendPushNotifications(targetTokens, title, message);
            
            // Save to Notification History
            await Notification.create({
                title,
                message,
                targetAll: true,
            });
            console.log("✅ [CRON] Test notification sent and logged.");
        } else {
            console.warn("⚠️ [CRON] No FCM tokens found to send notification.");
        }
    } catch (err) {
        console.error("❌ [CRON] Error sending scheduled notification:", err.message);
    }
});

// 2. Real Logic: Automatic Notification on 10th of every month at 10 AM
cron.schedule("0 10 10 * *", async () => {
    console.log("⏰ [CRON] Running monthly installment reminder (10th at 10 AM)...");
    try {
        const title = "Installment Payment Reminder";
        const message = "The 10th of the month is here. Please check your payment dashboard for any pending installments.";

        const users = await User.find({ fcmToken: { $exists: true, $ne: "" } }).select("fcmToken");
        const targetTokens = users.map(u => u.fcmToken);

        if (targetTokens.length > 0) {
            await sendPushNotifications(targetTokens, title, message);
            await Notification.create({ title, message, targetAll: true });
        }
    } catch (err) {
        console.error("❌ [CRON] Error in monthly reminder:", err.message);
    }
});

console.log("📅 [CRON] Scheduler initialized.");
