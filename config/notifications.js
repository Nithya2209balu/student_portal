const axios = require("axios");
const admin = require("./firebase");

/**
 * Send Push Notifications using either FCM or Expo
 * @param {string[]} tokens - Array of target device tokens
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {object} data - Optional extra data payload
 */
const sendPushNotifications = async (tokens, title, body, data = {}) => {
    if (!tokens || tokens.length === 0) {
        console.warn("⚠️ Notification aborted: Empty token list provided.");
        return;
    }

    const expoTokens = [];
    const fcmTokens = [];

    // 1. Sort tokens into Expo and FCM groups
    tokens.forEach((token) => {
        if (!token || typeof token !== "string") {
            return;
        }

        if (token.startsWith("ExponentPushToken[")) {
            expoTokens.push(token);
        } else {
            fcmTokens.push(token);
        }
    });

    const results = { fcm: null, expo: null };

    // 2. Send via FCM (Firebase)
    if (fcmTokens.length > 0) {
        try {
            const message = {
                notification: {
                    title: title || "Hello 👋",
                    body: body || "New Notification",
                },
                data: { screen: "home", ...data },
                tokens: fcmTokens,
            };

            const response = await admin.messaging().sendEachForMulticast(message);
            console.log(`✅ FCM Push Notifications: ${response.successCount} success, ${response.failureCount} failure`);
            results.fcm = response;
        } catch (err) {
            console.error("❌ FCM Notification error:", err.message);
        }
    }

    // 3. Send via Expo (Fallback or grouped)
    if (expoTokens.length > 0) {
        try {
            const messages = expoTokens.map((token) => ({
                to: token,
                sound: "default",
                title: title || "Hello 👋",
                body: body || "New Notification",
                data: { screen: "home", ...data },
            }));

            const response = await axios.post(
                "https://exp.host/--/api/v2/push/send",
                messages,
                {
                    headers: {
                        "Content-Type": "application/json",
                        "Accept": "application/json",
                        "Accept-encoding": "gzip, deflate",
                    },
                }
            );

            console.log("✅ Expo Push Notifications sent:", response.data);
            results.expo = response.data;
        } catch (err) {
            console.error("❌ Expo Notification error:", err.response?.data || err.message);
        }
    }

    return results;
};

module.exports = { sendPushNotifications };
