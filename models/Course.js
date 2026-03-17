const mongoose = require("mongoose");

const courseSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        description: { type: String },
        imageUrl: { type: String },
        fees: { type: Number, required: true, default: 0 },
        category: { type: String, required: true },
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
