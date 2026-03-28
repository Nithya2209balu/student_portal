const mongoose = require("mongoose");

const leaveSchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        type: { type: String, required: true, trim: true },         // e.g. "Sick Leave", "Casual Leave"
        description: { type: String, trim: true },
        startDate: { type: Date, required: true },
        endDate: { type: Date, required: true },
        status: {
            type: String,
            enum: ["pending", "approved", "rejected"],
            default: "pending",
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Leave", leaveSchema);
