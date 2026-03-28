const axios = require("axios");

/**
 * Send Push Notifications using Expo's API
 * @param {string[]} tokens - Array of target device tokens
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {object} data - Optional extra data payload
 */
const sendPushNotifications = async (tokens, title, body, data = {}) => {
    if (!tokens || tokens.length === 0) {
        console.warn("⚠️ Expo Notification aborted: Empty token list provided.");
        return;
    }

    try {
        const messages = tokens.map((token) => ({
            to: token,
            sound: "default",
            title: title || "Hello 👋",
            body: body || "Test Notification",
            data: { screen: "home", ...data },
        }));

        const response = await axios.post(
            "https://exp.host/--/api/v2/push/send",
            messages,
            {
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                    "Accept-encoding": "gzip, deflate"
                },
            }
        );

        console.log("✅ Expo Push Notifications sent:", response.data);
        return response.data;
    } catch (err) {
        console.error("❌ Expo Notification error:", err.response?.data || err.message);
    }
};

module.exports = { sendPushNotifications };
