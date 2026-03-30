const admin = require("firebase-admin");

/**
 * Initialize Firebase Admin SDK
 * 
 * IMPORTANT: For cloud messaging to work, you ideally need a service account JSON.
 * If you don't have one, this will initialize using the Project ID, but 
 * sending might fail without proper credentials.
 */
try {
    if (!admin.apps.length) {
        admin.initializeApp({
            projectId: process.env.FIREBASE_PROJECT_ID,
            // If you have a service account JSON, you should use:
            // credential: admin.credential.cert(require("./path-to-service-account.json"))
        });
        console.log("🔥 Firebase Admin initialized");
    }
} catch (error) {
    console.error("❌ Firebase Admin initialization error:", error.message);
}

module.exports = admin;
