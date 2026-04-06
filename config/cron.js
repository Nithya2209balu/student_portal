const cron = require("node-cron");
const User = require("../models/User");
const Notification = require("../models/Notification");
const { sendPushNotifications } = require("./notifications");

/**
 * Scheduled Jobs
 */
const initCronJobs = () => {
    // 5-Minute test notification removed as per request.
    // Add real production cron jobs here in the future.
    console.log("✅ Cron Jobs initialized (No active background tasks)");
};

module.exports = { initCronJobs };
