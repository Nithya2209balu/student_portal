const mongoose = require("mongoose");

const noteSchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        courseId: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
        lessonId: { type: mongoose.Schema.Types.ObjectId, ref: "Lesson" },
        content: { type: String, required: true },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Note", noteSchema);
