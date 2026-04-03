const express = require("express");
const router = express.Router();
const upload = require("../middlewares/upload");
const { createTask, getTasks, getTaskById, updateTask, deleteTask, getTaskDashboard, getAdminTaskDashboard } = require("../controllers/taskController");
const { protect, isAdmin } = require("../middlewares/auth");

router.get("/dashboard/:userId", protect, getTaskDashboard);
router.get("/admin/dashboard", protect, isAdmin, getAdminTaskDashboard);

// We configure multer to accept fields specific to the request
const cpUpload = upload.fields([
  { name: 'image', maxCount: 10 },
  { name: 'document', maxCount: 1 }
]);

router.post("/", protect, cpUpload, createTask);
router.get("/", protect, getTasks);
router.get("/:id", protect, getTaskById);
router.put("/:id", protect, cpUpload, updateTask);
router.delete("/:userId/:taskId", protect, deleteTask);

module.exports = router;
