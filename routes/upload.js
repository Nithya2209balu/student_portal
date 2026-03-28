const express = require('express');
const router = express.Router();
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { protect, isAdmin } = require('../middlewares/auth');

// Initialize Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Use memory storage so we don't save files to disk before uploading to Cloudinary
const upload = multer({ storage: multer.memoryStorage() });

/**
 * POST /api/upload
 * Requires JWT token. 
 * Uploads a single image field named 'image'.
 */
router.post('/', protect, upload.single('image'), (req, res, next) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'Please upload an image file using the field name "image".' });
    }

    // Stream the file buffer to Cloudinary
    const uploadStream = cloudinary.uploader.upload_stream(
        { folder: 'student_portal_assets' },
        (error, result) => {
            if (error) {
                console.error("Cloudinary Error:", error);
                return res.status(500).json({ success: false, message: 'Image upload failed', error });
            }

            res.status(200).json({
                success: true,
                message: 'Image uploaded successfully',
                data: {
                    url: result.secure_url,
                    public_id: result.public_id
                }
            });
        }
    );

    uploadStream.end(req.file.buffer);
});

module.exports = router;
