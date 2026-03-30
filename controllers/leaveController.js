const Leave = require("../models/Leave");
const Notification = require("../models/Notification");

// ── Helper: strip timestamps from response ───────────────────────────────────
const clean = (doc) => {
    const obj = doc.toObject();
    delete obj.createdAt;
    delete obj.updatedAt;
    return obj;
};

// ── Create Leave Request ──────────────────────────────────────────────────────
// POST /api/leave
exports.createLeave = async (req, res, next) => {
    try {
        const { userId, type, description, startDate, endDate } = req.body;

        if (!userId)    return res.status(400).json({ success: false, message: "userId is required" });
        if (!type)      return res.status(400).json({ success: false, message: "Leave type is required" });
        if (!startDate) return res.status(400).json({ success: false, message: "startDate is required" });
        if (!endDate)   return res.status(400).json({ success: false, message: "endDate is required" });

        const start = new Date(startDate);
        const end   = new Date(endDate);

        if (isNaN(start) || isNaN(end)) {
            return res.status(400).json({ success: false, message: "Invalid date format. Use YYYY-MM-DD" });
        }

        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);

        if (start < today) {
            return res.status(400).json({ success: false, message: "Leave cannot be applied for past dates" });
        }

        if (end < start) {
            return res.status(400).json({ success: false, message: "endDate cannot be before startDate" });
        }

        const leave = await Leave.create({
            userId,
            type,
            description,
            startDate: start,
            endDate: end,
            status: "pending",
        });

        res.status(201).json({
            success: true,
            message: "Leave request submitted successfully",
            data: clean(leave),
        });
    } catch (err) { next(err); }
};

// ── Get All Leaves (Admin) ────────────────────────────────────────────────────
// GET /api/leave
// GET /api/leave?status=pending
// GET /api/leave?status=approved
// GET /api/leave?status=rejected
exports.getAllLeaves = async (req, res, next) => {
    try {
        const { status } = req.query;
        const filter = {};
        if (status) filter.status = status;

        const leaves = await Leave.find(filter)
            .select("-createdAt -updatedAt")
            .sort({ startDate: -1 });

        res.json({ success: true, total: leaves.length, data: leaves });
    } catch (err) { next(err); }
};

// ── Get Leaves by User ID ─────────────────────────────────────────────────────
// GET /api/leave/:userId
// GET /api/leave/:userId?startDate=2026-03-01&endDate=2026-03-31
// GET /api/leave/:userId?month=03&year=2026
exports.getLeavesByUser = async (req, res, next) => {
    try {
        const { userId } = req.params;
        const { startDate, endDate, month, year } = req.query;
        const filter = { userId };

        if (month && year) {
            const m = parseInt(month, 10);
            const y = parseInt(year, 10);
            const from = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
            const to   = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
            filter.startDate = { $gte: from, $lte: to };
        } else if (startDate || endDate) {
            filter.startDate = {};
            if (startDate) filter.startDate.$gte = new Date(startDate);
            if (endDate) {
                const end = new Date(endDate);
                end.setUTCHours(23, 59, 59, 999);
                filter.startDate.$lte = end;
            }
        }

        const leaves = await Leave.find(filter)
            .select("-createdAt -updatedAt")
            .sort({ startDate: -1 });

        res.json({ success: true, total: leaves.length, data: leaves });
    } catch (err) { next(err); }
};

// ── Update Leave Status (Admin Approve / Reject) ──────────────────────────────
// PUT /api/leave/:leaveId/status
// Body: { "status": "approved" | "rejected" }
exports.updateLeaveStatus = async (req, res, next) => {
    try {
        const { leaveId } = req.params;
        const { status } = req.body;

        if (!["approved", "rejected"].includes(status)) {
            return res.status(400).json({ success: false, message: "status must be 'approved' or 'rejected'" });
        }

        const leave = await Leave.findByIdAndUpdate(
            leaveId,
            { status },
            { new: true }
        );

        if (!leave) return res.status(404).json({ success: false, message: "Leave request not found" });

        // 🔔 Save notification to DB history
        const statusLabel = status === "approved" ? "Approved ✅" : "Rejected ❌";
        const title = `Leave Request ${statusLabel}`;
        const message = `Your ${leave.type} request from ${leave.startDate.toISOString().slice(0, 10)} to ${leave.endDate.toISOString().slice(0, 10)} has been ${status}.`;

        await Notification.create({
            userId: leave.userId,
            targetAll: false,
            title,
            message,
        });

        // 📡 Trigger Push Notification
        const user = await User.findById(leave.userId).select("fcmToken");
        if (user && user.fcmToken) {
            await sendPushNotifications([user.fcmToken], title, message);
        }

        res.json({
            success: true,
            message: `Leave request ${status} successfully`,
            data: clean(leave),
        });
    } catch (err) { next(err); }
};
