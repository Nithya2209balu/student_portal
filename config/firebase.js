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

        if (fs.existsSync(serviceAccountPath)) {
            try {
                const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));
                // Ensure private key has actual newlines, not literal '\n' strings
                if (serviceAccount.private_key) {
                    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
                }

                admin.initializeApp({
                    credential: admin.credential.cert(serviceAccount),
                });
                console.log("🔥 Firebase Admin initialized successfully with Service Account");
            } catch (jsonErr) {
                console.error("❌ Error parsing serviceAccountKey.json:", jsonErr.message);
            }
        } else {
            console.warn("⚠️ Firebase Admin: serviceAccountKey.json not found. Notifications may fail.");
        }
    }
} catch (error) {
    console.error("❌ Firebase Admin initialization error:", error.message);
}

module.exports = admin;
