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
        const path = require("path");
        const fs = require("fs");
        const serviceAccountPath = path.join(__dirname, "serviceAccountKey.json");

        let serviceAccount;

        // 1. Try environment variable first (Recommended for Render/Heroku)
        if (process.env.FIREBASE_SERVICE_ACCOUNT) {
            try {
                serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
                console.log("🔥 Firebase Admin: Using credentials from Environment Variable");
            } catch (err) {
                console.error("❌ Firebase Admin: Error parsing FIREBASE_SERVICE_ACCOUNT env var", err.message);
            }
        }

        // 2. Try file if no env var or env var failed
        if (!serviceAccount && fs.existsSync(serviceAccountPath)) {
            try {
                serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));
                console.log("🔥 Firebase Admin: Using credentials from serviceAccountKey.json");
            } catch (jsonErr) {
                console.error("❌ Firebase Admin: Error parsing serviceAccountKey.json:", jsonErr.message);
            }
        }

        if (serviceAccount) {
            // Ensure private key has actual newlines
            if (serviceAccount.private_key) {
                serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
            }

            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
            });
            console.log("🔥 Firebase Admin initialized successfully");
        } else {
            console.warn("⚠️ Firebase Admin: No credentials found (ENV or File). Notifications will fail.");
        }
    }
} catch (error) {
    console.error("❌ Firebase Admin initialization error:", error.message);
}

module.exports = admin;
