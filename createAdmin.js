require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const connectDB = require("./config/db");

const createAdmin = async () => {
    await connectDB();

    const User = require("./models/User");

    const email = "hr@by8labs.com";
    const existing = await User.findOne({ email });

    if (existing) {
        console.log("Admin already exists:", existing.email);
        process.exit(0);
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash("nancy123", salt);

    await User.create({
        name: "HR Admin",
        email,
        mobile: "0000000000",
        password: hashedPassword,
        studentType: "online",
        role: "admin",
        isApproved: true,
    });

    console.log("✅ Admin created!");
    console.log("   Email   : hr@by8labs.com");
    console.log("   Password: nancy123");
    process.exit(0);
};

createAdmin().catch((err) => {
    console.error(err);
    process.exit(1);
});
