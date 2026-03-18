const mongoose = require("mongoose");

const courseCategorySchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        description: { type: String },
        imageUrl: { type: String },
        fees: { type: Number, default: 0 },
        categoryCode: { type: Number, unique: true, sparse: true }, // fixed IDs: 1001=AI, 1002=Web Development
        parentCategoryId: { type: mongoose.Schema.Types.ObjectId, ref: "CourseCategory", default: null },
    },
    { timestamps: true }
);

module.exports = mongoose.model("CourseCategory", courseCategorySchema);
