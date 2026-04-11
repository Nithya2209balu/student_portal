const mongoose = require("mongoose");

const admissionSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        course: { type: String, required: true, trim: true },
        phone: { type: String, required: true },
        email: { type: String, required: true, lowercase: true },
        status: { type: String, default: "completed" },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Admission", admissionSchema);
