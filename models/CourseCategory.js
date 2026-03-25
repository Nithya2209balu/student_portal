const mongoose = require("mongoose");
const Counter = require("./Counter");

const courseCategorySchema = new mongoose.Schema(
    {
        courseId: { type: Number, unique: true, sparse: true }, // auto-increment from 2000
        name: { type: String, required: true, trim: true },
        description: { type: String },
        imageUrl: { type: String },
        fees: { type: Number, default: 0 },
        duration: { type: Number }, // duration in months
        categoryCode: { type: Number, unique: true, sparse: true }, // fixed IDs: 1001=AI, 1002=Web Development
        parentCategoryId: { type: mongoose.Schema.Types.ObjectId, ref: "CourseCategory", default: null },
    },
    { timestamps: true }
);

// Auto-increment courseId starting from 2000 for user-created categories (not the root AI/Web Dev ones)
courseCategorySchema.pre("save", async function (next) {
    // Only assign courseId to sub-categories (those with a parent), and only on first save
    if (!this.isNew || !this.parentCategoryId || this.courseId) return next();

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

module.exports = mongoose.model("CourseCategory", courseCategorySchema);
