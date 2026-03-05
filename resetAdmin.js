require("dotenv").config();
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const connectDB = require("./config/db");

const fixAdmin = async () => {
    await connectDB();

    // Use raw mongoose to avoid any model cache issues
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash("nancy123", salt);

    const db = mongoose.connection.db;
    const users = db.collection("users");

    // Check if user exists
    const existing = await users.findOne({ email: "hr@by8labs.com" });

    if (existing) {
        // Update password + role
        await users.updateOne(
            { email: "hr@by8labs.com" },
            { $set: { password: hashedPassword, role: "admin", isApproved: true } }
        );
        console.log("✅ Admin password & role updated!");
    } else {
        // Create fresh
        await users.insertOne({
            name: "HR Admin",
            email: "hr@by8labs.com",
            mobile: "0000000000",
            password: hashedPassword,
            studentType: "online",
            role: "admin",
            isApproved: true,
            createdAt: new Date(),
            updatedAt: new Date(),
        });
        console.log("✅ Admin created fresh!");
    }

    console.log("   Email   : hr@by8labs.com");
    console.log("   Password: nancy123");
    console.log("   Role    : admin");
    process.exit(0);
};

fixAdmin().catch((err) => { console.error(err); process.exit(1); });
