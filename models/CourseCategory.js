const mongoose = require("mongoose");

const courseCategorySchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        description: { type: String },
        imageUrl: { type: String },
    },
    { timestamps: true }
);

module.exports = mongoose.model("CourseCategory", courseCategorySchema);
