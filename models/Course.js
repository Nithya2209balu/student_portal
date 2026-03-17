const mongoose = require("mongoose");

const courseSchema = new mongoose.Schema(
    {
        title: { type: String, required: true, trim: true },
        description: { type: String },
        imageUrl: { type: String },
        amount: { type: Number, required: true, default: 0 },
        categoryId: { type: mongoose.Schema.Types.ObjectId, ref: "CourseCategory" },
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
