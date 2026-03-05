const mongoose = require("mongoose");

const lessonSchema = new mongoose.Schema(
    {
        courseId: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
        title: { type: String, required: true, trim: true },
        duration: { type: String }, // e.g. "25 mins"
        videoUrl: { type: String },
        order: { type: Number, default: 0 },
        isCompleted: { type: Boolean, default: false },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Lesson", lessonSchema);
