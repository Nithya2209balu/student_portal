const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const documentController = require("../controllers/documentController");

// ── Multer Configuration ─────────────────────────────────────────────────────
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "uploads/docs/");
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname));
    },
});

const fileFilter = (req, file, cb) => {
    if (file.mimetype === "application/pdf") {
        cb(null, true);
    } else {
        cb(new Error("Only PDF files are allowed!"), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

// ── Routes ────────────────────────────────────────────────────────────────────

// POST /api/documents/upload
router.post("/upload", upload.single("file"), documentController.uploadDocument);

// GET /api/documents/:userId
router.get("/:userId", documentController.getDocuments);

// GET /api/documents/download/:documentId
router.get("/download/:documentId", documentController.downloadDocument);

module.exports = router;
