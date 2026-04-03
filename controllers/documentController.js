const Document = require("../models/Document");
const path = require("path");
const fs = require("fs");

// ── Upload Document ──────────────────────────────────────────────────────────
exports.uploadDocument = async (req, res, next) => {
    try {
        const { userId } = req.params;
        const { courseId } = req.body;

        if (!req.file) {
            return res.status(400).json({ success: false, message: "Please upload a PDF file" });
        }

        if (!courseId) {
            return res.status(400).json({ success: false, message: "courseId is required" });
        }

        const document = await Document.create({
            userId,
            courseId,
            fileName: req.file.originalname,
            fileUrl: `uploads/docs/${req.file.filename}`,
        });

        res.status(201).json({
            success: true,
            message: "Document uploaded successfully",
            data: {
                userId: document.userId,
                courseId: document.courseId,
                fileUrl: document.fileUrl,
            },
        });
    } catch (err) {
        next(err);
    }
};

// ── Get Documents by User ────────────────────────────────────────────────────
exports.getDocuments = async (req, res, next) => {
    try {
        const { userId } = req.params;

        const documents = await Document.find({ userId }).sort({ uploadedAt: -1 });

        const data = documents.map((doc) => ({
            documentId: doc._id,
            courseId: doc.courseId,
            fileUrl: doc.fileUrl,
            uploadedAt: doc.uploadedAt.toISOString().split("T")[0],
        }));

        res.status(200).json({
            success: true,
            data,
        });
    } catch (err) {
        next(err);
    }
};

// ── Download Document ────────────────────────────────────────────────────────
exports.downloadDocument = async (req, res, next) => {
    try {
        const { userId, documentId } = req.params;

        const document = await Document.findById(documentId);

        if (!document) {
            return res.status(404).json({ success: false, message: "Document not found" });
        }

        if (document.userId.toString() !== userId) {
            return res.status(403).json({ success: false, message: "Unauthorized access to this document" });
        }

        const filePath = path.join(__dirname, "..", document.fileUrl);

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ success: false, message: "File not found on server" });
        }

        res.download(filePath, document.fileName);
    } catch (err) {
        next(err);
    }
};
