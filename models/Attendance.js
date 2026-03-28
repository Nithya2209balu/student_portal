const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        courseId: { type: Number },  // custom numeric courseId (e.g. 2000, 2001...)
        date: { type: Date, required: true },
        status: {
            type: String,
            enum: ["present", "absent", "holiday"],
            required: true,
        },
        remarks: { type: String },
    },
    { timestamps: true }
);

// Prevent duplicate attendance for same user+course+date
attendanceSchema.index({ userId: 1, courseId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("Attendance", attendanceSchema);
