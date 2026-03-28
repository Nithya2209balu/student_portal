const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Ensure the specific uploads directory exists
const uploadDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, "uploads/"); 
    },
    filename: function (req, file, cb) {
        // Create unique filenames to prevent overwriting
        cb(null, Date.now() + "-" + file.originalname.replace(/\s+/g, "_"));
    },
});

const upload = multer({ 
    storage,
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB file size limit
});

module.exports = upload;
