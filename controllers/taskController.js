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

        let imageUrls = [];
        let documentUrl = req.body.documentUrl || null;

        if (req.files) {
            if (req.files.image && req.files.image.length > 0) {
                imageUrls = req.files.image.map(file => buildUrl(req, file.filename));
            }
            if (req.files.document && req.files.document[0]) {
                documentUrl = buildUrl(req, req.files.document[0].filename);
            }
        }

        const task = await Task.create({
            title,
            description,
            imageUrls,
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
        
        // Handle incoming URLs if they are passed as strings or arrays in req.body
        if (req.body.imageUrls) {
            task.imageUrls = Array.isArray(req.body.imageUrls) ? req.body.imageUrls : [req.body.imageUrls];
        }
        if (req.body.documentUrl) task.documentUrl = req.body.documentUrl;

        // If new files are uploaded, append/replace the URLs
        if (req.files) {
            if (req.files.image && req.files.image.length > 0) {
                const newImageUrls = req.files.image.map(file => buildUrl(req, file.filename));
                task.imageUrls = [...task.imageUrls, ...newImageUrls];
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

/**
 * DELETE /api/tasks/:userId/:taskId
 * Delete task based on user and task ID
 */
exports.deleteTask = async (req, res, next) => {
    try {
        const { userId, taskId } = req.params;
        const task = await Task.findOneAndDelete({ _id: taskId, createdBy: userId });
        
        if (!task) {
            return res.status(404).json({ 
                success: false, 
                message: "Task not found or you don't have permission to delete it" 
            });
        }

        res.json({ success: true, message: "Task deleted successfully" });
    } catch (err) {
        next(err);
    }
};
