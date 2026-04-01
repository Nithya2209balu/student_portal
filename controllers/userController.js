const User = require("../models/User");
const cloudinary = require("cloudinary").v2;

// Configure Cloudinary (usually already done in routes/upload.js, but re-confirming if needed)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

/**
 * 🔹 POST /api/users/upload-profile/:userId
 */
exports.uploadProfileImage = async (req, res, next) => {
    try {
        const { userId } = req.params;
        if (!req.file) {
            return res.status(400).json({ success: false, message: "Please upload an image file using the field name 'image'." });
        }

        // Stream the file buffer to Cloudinary
        const uploadStream = cloudinary.uploader.upload_stream(
            { folder: "profile_images" },
            async (error, result) => {
                if (error) {
                    console.error("Cloudinary Error:", error);
                    return res.status(500).json({ success: false, message: "Image upload failed", error });
                }

                const user = await User.findByIdAndUpdate(
                    userId,
                    { profileImage: result.secure_url },
                    { new: true }
                ).select("-password -otp -otpExpiry");

                if (!user) {
                    return res.status(404).json({ success: false, message: "User not found" });
                }

                res.status(200).json({
                    success: true,
                    message: "Profile image uploaded and updated successfully",
                    data: {
                        userId: user._id,
                        profileImage: user.profileImage
                    }
                });
            }
        );

        uploadStream.end(req.file.buffer);
    } catch (err) {
        next(err);
    }
};

/**
 * 🔹 PUT /api/users/update/:userId
 */
exports.updateUserProfile = async (req, res, next) => {
    try {
        const { userId } = req.params;
        const { name, email, mobile, oldPassword, newPassword } = req.body;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        // Update basic fields
        if (name) user.name = name;
        if (email) user.email = email.toLowerCase();
        if (mobile) user.mobile = mobile;

        // Password update logic
        if (newPassword) {
            if (!oldPassword) {
                return res.status(400).json({ success: false, message: "Old password is required to update to a new password" });
            }

            const isMatch = await user.matchPassword(oldPassword);
            if (!isMatch) {
                return res.status(401).json({ success: false, message: "Incorrect old password" });
            }

            user.password = newPassword; // Hashing will be handled by pre-save hook
        }

        await user.save();

        // Sanitize response
        const updatedUser = user.toObject();
        delete updatedUser.password;
        delete updatedUser.otp;
        delete updatedUser.otpExpiry;

        res.json({
            success: true,
            message: "User profile updated successfully",
            data: updatedUser
        });
    } catch (err) {
        next(err);
    }
};
