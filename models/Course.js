const mongoose = require("mongoose");
const Counter = require("./Counter");

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
        courseId: { type: Number, unique: true },
    },
    { timestamps: true }
);

// Auto-increment courseId
courseSchema.pre("save", async function (next) {
    if (!this.isNew) return next();

    try {
        const counter = await Counter.findOneAndUpdate(
            { id: "courseId" },
            { $inc: { seq: 1 } },
            { new: true, upsert: true }
        );
        this.courseId = counter.seq;
        next();
    } catch (error) {
        next(error);
    }
});

module.exports = mongoose.model("Course", courseSchema);
