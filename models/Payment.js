const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        courseId: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
        totalFees: { type: Number, required: true },
        paidAmount: { type: Number, default: 0 },
        remainingAmount: { type: Number, required: true },
        durationInDays: { type: Number, required: true },
        startDate: { type: Date, default: Date.now },
        endDate: { type: Date, required: true },
        nextInstallmentDate: { type: Date },
        status: {
            type: String,
            enum: ["pending", "partial", "paid"],
            default: "pending",
        },
        transactions: [
            {
                amount: { type: Number, required: true },
                date: { type: Date, default: Date.now },
                method: { type: String, enum: ["cash", "upi", "card", "online"], default: "cash" },
                paymentType: { type: String, enum: ["MANUAL", "ONLINE"], default: "MANUAL" },
                installmentNumber: { type: Number },
                sessionId: { type: String },
                paymentIntentId: { type: String },
                type: { type: String, default: "Installment" }, // e.g. "Admission Fee", "Installment 1"
                receiptId: { type: String }, // e.g. "REC-9921"
                status: { type: String, default: "success" },
                collectedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // admin
            },
        ],
    },
    { timestamps: true }
);

module.exports = mongoose.model("Payment", paymentSchema);
