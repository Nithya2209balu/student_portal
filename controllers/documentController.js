const Document = require("../models/Document");
const path = require("path");
const fs = require("fs");

// ── Upload Document ──────────────────────────────────────────────────────────
exports.uploadDocument = async (req, res, next) => {
    try {
        let { courseName } = req.body;

        if (!req.file) {
            return res.status(400).json({ success: false, message: "Please upload a PDF file" });
        }

        if (!courseName) {
            return res.status(400).json({ success: false, message: "courseName is required" });
        }

        // Clean courseName (strip surrounding quotes if any)
        courseName = courseName.trim().replace(/^"(.*)"$/, "$1");

        const document = await Document.create({
            courseName: courseName.trim(),
            fileName: req.file.originalname,
            fileUrl: `uploads/docs/${req.file.filename}`,
        });

        res.status(201).json({
            success: true,
            message: "Document uploaded successfully",
            data: {
                courseName: document.courseName,
                fileUrl: document.fileUrl,
            },
        });
    } catch (err) {
        next(err);
    }
};

// ── Get All Documents (Admin) ────────────────────────────────────────────────
exports.getAllDocuments = async (req, res, next) => {
    try {
        const documents = await Document.find({}).sort({ uploadedAt: -1 });

        const data = documents.map((doc) => ({
            documentId: doc._id,
            courseName: doc.courseName,
            fileName: doc.fileName,
            fileUrl: doc.fileUrl,
            uploadedAt: doc.uploadedAt,
        }));

        res.status(200).json({
            success: true,
            data,
        });
    } catch (err) {
        next(err);
    }
};

// ── Get Documents by User (Fetches Course-wide Documents) ────────────────────
exports.getDocuments = async (req, res, next) => {
    try {
        const { userId } = req.params;
        const User = require("../models/User");

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        const courseName = user.courseName ? user.courseName.trim() : null;
        if (!courseName) {
            return res.json({ success: true, data: [] });
        }

        // Fetch all documents matching this user's courseName (case-insensitive)
        const documents = await Document.find({ 
            courseName: { $regex: new RegExp("^" + courseName + "$", "i") } 
        }).sort({ uploadedAt: -1 });

        const data = documents.map((doc) => ({
            documentId: doc._id,
            courseName: doc.courseName,
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
        const { documentId } = req.params;

        const document = await Document.findById(documentId);

        if (!document) {
            return res.status(404).json({ success: false, message: "Document not found" });
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
