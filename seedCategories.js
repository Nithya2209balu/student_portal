/**
 * seedCategories.js
 * -----------------
 * Seeds the base categories (AI and Web Development) into the database.
 * These are required by the /api/courses/categories/names endpoint.
 *
 * Usage:
 *   node seedCategories.js
 */

require("dotenv").config();
const mongoose = require("mongoose");
const CourseCategory = require("./models/CourseCategory");

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

if (!MONGO_URI) {
    console.error("❌ No MONGO_URI found in .env");
    process.exit(1);
}

const baseCategories = [
    {
        name: "AI",
        categoryCode: 1001,
        description: "Artificial Intelligence and Machine Learning",
    },
    {
        name: "Web Development",
        categoryCode: 1002,
        description: "Full Stack Web Development",
    }
];

async function seed() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log("✅ Connected to MongoDB");

        for (const cat of baseCategories) {
            const existing = await CourseCategory.findOne({ categoryCode: cat.categoryCode });
            if (!existing) {
                await CourseCategory.create(cat);
                console.log(`✅ Created base category: ${cat.name} (${cat.categoryCode})`);
            } else {
                console.log(`ℹ️ Category ${cat.name} already exists.`);
            }
        }

        await mongoose.disconnect();
        console.log("✅ Seed complete. Disconnected.");
    } catch (err) {
        console.error("❌ Error seeding categories:", err.message);
        process.exit(1);
    }
}

seed();
