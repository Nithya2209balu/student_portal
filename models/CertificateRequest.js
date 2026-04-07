const mongoose = require("mongoose");

const certificateRequestSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        studentName: {
            type: String,
            required: true,
        },
        status: {
            type: String,
            enum: ["Pending", "Approved", "Rejected"],
            default: "Pending",
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model("CertificateRequest", certificateRequestSchema);
