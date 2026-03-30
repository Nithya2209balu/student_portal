const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
    {
        title: { type: String, required: true },
        message: { type: String, required: true },
        isRead: { type: Boolean, default: false },
        targetAll: { type: Boolean, default: true }, // broadcast to all users
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // optional user-specific
    },
    { timestamps: true }
);

module.exports = mongoose.model("Notification", notificationSchema);
