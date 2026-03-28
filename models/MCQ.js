const mongoose = require("mongoose");

const mcqSchema = new mongoose.Schema(
    {
        lessonId: { type: mongoose.Schema.Types.ObjectId, ref: "Lesson", required: true },
        courseId: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
        question: { type: String, required: true },
        options: {
            type: [String],
            validate: [(arr) => arr.length === 4, "Must have exactly 4 options"],
        },
        correctOption: { type: Number, min: 0, max: 3, required: true }, // index 0-3
    },
    { timestamps: true }
);

module.exports = mongoose.model("MCQ", mcqSchema);
