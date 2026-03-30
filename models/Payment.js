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
        status: {
            type: String,
            enum: ["pending", "partial", "paid"],
            default: "pending",
        },
        transactions: [
            {
                amount: { type: Number, required: true },
                date: { type: Date, default: Date.now },
                method: { type: String, enum: ["cash", "upi", "card"], required: true },
                collectedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // admin
            },
        ],
    },
    { timestamps: true }
);

module.exports = mongoose.model("Payment", paymentSchema);
