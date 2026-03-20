const Leave = require("../models/Leave");

// ── Create Leave Request ──────────────────────────────────────────────────────
// POST /api/leave
exports.createLeave = async (req, res, next) => {
    try {
        const { type, description, startDate, endDate } = req.body;

        if (!type)      return res.status(400).json({ success: false, message: "Leave type is required" });
        if (!startDate) return res.status(400).json({ success: false, message: "startDate is required" });
        if (!endDate)   return res.status(400).json({ success: false, message: "endDate is required" });

        const start = new Date(startDate);
        const end   = new Date(endDate);

        if (isNaN(start) || isNaN(end)) {
            return res.status(400).json({ success: false, message: "Invalid date format. Use YYYY-MM-DD" });
        }
        if (end < start) {
            return res.status(400).json({ success: false, message: "endDate cannot be before startDate" });
        }

        const leave = await Leave.create({
            userId: req.user.id,
            type,
            description,
            startDate: start,
            endDate: end,
        });

        res.status(201).json({
            success: true,
            message: "Leave request submitted successfully",
            data: leave,
        });
    } catch (err) { next(err); }
};

// ── Get Leave Requests ────────────────────────────────────────────────────────
// GET /api/leave
// GET /api/leave?startDate=2026-03-01&endDate=2026-03-31
// GET /api/leave?month=03&year=2026
exports.getLeaves = async (req, res, next) => {
    try {
        const { startDate, endDate, month, year } = req.query;
        const filter = { userId: req.user.id };

        if (month && year) {
            // Monthly filter: all records whose startDate falls in that month
            const m = parseInt(month, 10);
            const y = parseInt(year, 10);
            const from = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
            const to   = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999)); // last day of month
            filter.startDate = { $gte: from, $lte: to };

        } else if (startDate || endDate) {
            // Date range filter
            filter.startDate = {};
            if (startDate) filter.startDate.$gte = new Date(startDate);
            if (endDate) {
                const end = new Date(endDate);
                end.setUTCHours(23, 59, 59, 999);
                filter.startDate.$lte = end;
            }
        }

        const leaves = await Leave.find(filter).sort({ startDate: -1 });

        res.json({
            success: true,
            total: leaves.length,
            data: leaves,
        });
    } catch (err) { next(err); }
};
