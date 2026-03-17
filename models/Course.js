const mongoose = require("mongoose");

const courseSchema = new mongoose.Schema(
    {
        // For Categories:
        isCategory: { type: Boolean, default: false },
        name: { type: String, trim: true }, // Used for Category name
        fees: { type: Number, default: 0 }, // Used for Category fees

        // For Courses:
        title: { type: String, trim: true },
        description: { type: String },
        imageUrl: { type: String },
        amount: { type: Number, default: 0 },
        category: { type: String }, // Links to Category name (string)
        tutorName: { type: String },
        tutorRole: { type: String },
        tutorImage: { type: String },
        reviewsCount: { type: Number, default: 0 },
        avgRating: { type: Number, default: 0 },
        isActive: { type: Boolean, default: true },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Course", courseSchema);
