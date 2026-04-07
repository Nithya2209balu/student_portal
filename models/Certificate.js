const mongoose = require("mongoose");

const certificateSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        requestId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "CertificateRequest",
            required: true,
        },
        certificateNumber: {
            type: String,
            required: true,
            unique: true,
        },
        courseName: {
            type: String,
            required: true,
        },
        content: {
            type: String,
            required: true,
        },
        duration: {
            type: String, // e.g., "5 months"
            default: "",
        },
        fileUrl: {
            type: String,
            required: true,
        },
        issuedAt: {
            type: Date,
            default: Date.now,
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Certificate", certificateSchema);
