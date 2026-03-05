const mongoose = require("mongoose");

const doubtSchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        courseId: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
        description: { type: String, required: true },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Doubt", doubtSchema);
