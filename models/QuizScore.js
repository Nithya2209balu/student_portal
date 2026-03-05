const mongoose = require("mongoose");

const quizScoreSchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        lessonId: { type: mongoose.Schema.Types.ObjectId, ref: "Lesson", required: true },
        courseId: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
        score: { type: Number, required: true },  // number of correct answers
        total: { type: Number, required: true },   // total questions attempted
        answers: [
            {
                mcqId: { type: mongoose.Schema.Types.ObjectId, ref: "MCQ" },
                selectedOption: { type: Number }, // index 0-3
                isCorrect: { type: Boolean },
            },
        ],
        takenAt: { type: Date, default: Date.now },
    },
    { timestamps: true }
);

module.exports = mongoose.model("QuizScore", quizScoreSchema);
