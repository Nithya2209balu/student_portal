const Task = require("../models/Task");

const buildUrl = (req, filename) => {
    return `${req.protocol}://${req.get("host")}/uploads/${filename}`;
};

/**
 * POST /api/tasks
 * Create a new task (multipart/form-data)
 */
exports.createTask = async (req, res, next) => {
    try {
        const { title, description, createdBy } = req.body;

        if (!title || !description || !createdBy) {
            return res.status(400).json({ success: false, message: "title, description, and createdBy are required" });
        }

        let imageUrl = req.body.imageUrl || null;
        let documentUrl = req.body.documentUrl || null;

        if (req.files) {
            if (req.files.image && req.files.image[0]) {
                imageUrl = buildUrl(req, req.files.image[0].filename);
            }
            if (req.files.document && req.files.document[0]) {
                documentUrl = buildUrl(req, req.files.document[0].filename);
            }
        }

        const task = await Task.create({
            title,
            description,
            imageUrl,
            documentUrl,
            createdBy
        });

        res.status(201).json({
            success: true,
            message: "Task created successfully",
            data: task
        });
    } catch (err) {
        next(err);
    }
};

/**
 * GET /api/tasks
 * List all tasks
 */
exports.getTasks = async (req, res, next) => {
    try {
        const tasks = await Task.find().sort({ createdAt: -1 });
        res.json({ success: true, count: tasks.length, data: tasks });
    } catch (err) {
        next(err);
    }
};

/**
 * GET /api/tasks/:id
 * Single task
 */
exports.getTaskById = async (req, res, next) => {
    try {
        const task = await Task.findById(req.params.id);
        if (!task) return res.status(404).json({ success: false, message: "Task not found" });

        res.json({ success: true, data: task });
    } catch (err) {
        next(err);
    }
};

/**
 * PUT /api/tasks/:id
 * Update task
 */
exports.updateTask = async (req, res, next) => {
    try {
        const { title, description, createdBy } = req.body;
        
        let task = await Task.findById(req.params.id);
        if (!task) return res.status(404).json({ success: false, message: "Task not found" });

        if (title) task.title = title;
        if (description) task.description = description;
        if (createdBy) task.createdBy = createdBy;
        if (req.body.imageUrl) task.imageUrl = req.body.imageUrl;
        if (req.body.documentUrl) task.documentUrl = req.body.documentUrl;

        // If new files are uploaded, update the URLs
        if (req.files) {
            if (req.files.image && req.files.image[0]) {
                task.imageUrl = buildUrl(req, req.files.image[0].filename);
            }
            if (req.files.document && req.files.document[0]) {
                task.documentUrl = buildUrl(req, req.files.document[0].filename);
            }
        }

        await task.save();

        res.json({ success: true, message: "Task updated successfully", data: task });
    } catch (err) {
        next(err);
    }
};

/**
 * GET /api/tasks/dashboard/:userId
 * User-specific task dashboard
 */
exports.getTaskDashboard = async (req, res, next) => {
    try {
        const totalTasks = await Task.countDocuments({ createdBy: req.params.userId });
        res.json({
            success: true,
            data: { totalTasks }
        });
    } catch (err) {
        next(err);
    }
};

/**
 * GET /api/tasks/admin/dashboard
 * Admin overall task dashboard
 */
exports.getAdminTaskDashboard = async (req, res, next) => {
    try {
        const totalTasks = await Task.countDocuments();
        res.json({
            success: true,
            data: { totalTasks }
        });
    } catch (err) {
        next(err);
    }
};
