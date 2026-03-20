/**
 * resetCourseCounter.js
 * ---------------------
 * Run this script ONCE if the "courseId" counter already exists in MongoDB
 * with an incorrect value (e.g., seq: 0 or seq: 1 from earlier testing).
 *
 * It upserts the counter document so that seq = 1999.
 * The next course saved will trigger $inc → seq becomes 2000.
 *
 * Usage:
 *   node resetCourseCounter.js
 */

require("dotenv").config();
const mongoose = require("mongoose");

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

if (!MONGO_URI) {
    console.error("❌  No MONGO_URI found in .env");
    process.exit(1);
}

async function main() {
    await mongoose.connect(MONGO_URI);
    console.log("✅  Connected to MongoDB");

    const Counter = require("./models/Counter");

    const result = await Counter.findOneAndUpdate(
        { id: "courseId" },
        { $set: { seq: 1999 } },
        { upsert: true, new: true }
    );

    console.log(`✅  Counter "courseId" is now set to seq = ${result.seq}`);
    console.log("👉  The next course created will receive courseId = 2000");

    await mongoose.disconnect();
    console.log("✅  Done. Disconnected.");
}

main().catch((err) => {
    console.error("❌  Error:", err.message);
    process.exit(1);
});
