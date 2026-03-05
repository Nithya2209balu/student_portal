const admin = require("firebase-admin");

// Using applicationDefault() requires GOOGLE_APPLICATION_CREDENTIALS env var
// OR initialize with inline credential object from Firebase console service account.
// For now, we initialize with the project ID so FCM messaging works after
// you download your serviceAccountKey.json from Firebase Console >
// Project Settings > Service Accounts > Generate new private key
// and set:  GOOGLE_APPLICATION_CREDENTIALS=./config/serviceAccountKey.json

let firebaseInitialized = false;

const initFirebase = () => {
    if (firebaseInitialized) return;
    try {
        // Try to load a service account key file if it exists
        let credential;
        try {
            const serviceAccount = require("./serviceAccountKey.json");
            credential = admin.credential.cert(serviceAccount);
        } catch {
            // Fall back to applicationDefault (set GOOGLE_APPLICATION_CREDENTIALS)
            credential = admin.credential.applicationDefault();
        }

        admin.initializeApp({
            credential,
            projectId: process.env.FIREBASE_PROJECT_ID || "student-f180c",
        });

        firebaseInitialized = true;
        console.log("✅ Firebase Admin SDK initialized");
    } catch (err) {
        console.warn(
            "⚠️  Firebase Admin SDK not fully initialized (FCM disabled):",
            err.message
        );
    }
};

/**
 * Send FCM push notification to a single device token.
 * @param {string} fcmToken - Target device FCM token
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {object} data - Optional extra data payload
 */
const sendPushNotification = async (fcmToken, title, body, data = {}) => {
    if (!fcmToken || !firebaseInitialized) return;
    try {
        const message = {
            token: fcmToken,
            notification: { title, body },
            data: Object.fromEntries(
                Object.entries(data).map(([k, v]) => [k, String(v)])
            ),
        };
        const response = await admin.messaging().send(message);
        console.log("FCM sent:", response);
    } catch (err) {
        console.error("FCM error:", err.message);
    }
};

module.exports = { initFirebase, sendPushNotification };
