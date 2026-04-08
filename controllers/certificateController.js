const CertificateRequest = require("../models/CertificateRequest");
const Certificate = require("../models/Certificate");
const User = require("../models/User");
const { generateCertificate } = require("../utils/pdfGenerator");
const cloudinary = require("cloudinary").v2;
const axios = require("axios");
const path = require("path");
const fs = require("fs");
const os = require("os");

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ── 0. Dashboard Stats (Admin/HR) ───────────────────────────────────────────
exports.getDashboardStats = async (req, res, next) => {
    try {
        const totalRequests = await CertificateRequest.countDocuments();
        const pendingRequests = await CertificateRequest.countDocuments({ status: "Pending" });
        const completedCertificates = await Certificate.countDocuments();

        res.status(200).json({
            success: true,
            data: {
                totalRequests,
                pendingRequests,
                completedCertificates,
            }
        });
    } catch (err) {
        next(err);
    }
};

// ── 1. Request Certificate (Student) ──────────────────────────────────────────
exports.requestCertificate = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        // Prevent duplicate pending/approved requests
        const existingRequest = await CertificateRequest.findOne({
            userId,
            status: { $in: ["Pending", "Approved"] },
        });

        if (existingRequest) {
            return res.status(400).json({
                success: false,
                message: `You already have a ${existingRequest.status.toLowerCase()} request.`
            });
        }

        const newRequest = await CertificateRequest.create({
            userId,
            studentName: user.name,
            status: "Pending",
        });

        res.status(201).json({
            success: true,
            message: "Certificate requested successfully",
            data: newRequest,
        });
    } catch (err) {
        next(err);
    }
};

// ── 2. Get All Requests (Admin/HR) ────────────────────────────────────────────
exports.getRequests = async (req, res, next) => {
    try {
        const { status } = req.query;
        let query = {};
        if (status) {
            query.status = status;
        }

        const requests = await CertificateRequest.find(query)
            .sort({ createdAt: -1 })
            .populate("userId", "name email courseName courseDuration");

        res.status(200).json({
            success: true,
            count: requests.length,
            data: requests,
        });
    } catch (err) {
        next(err);
    }
};

// ── 2b. Get All Completed Certificates (Admin/HR) ─────────────────────────────
exports.getAllCertificates = async (req, res, next) => {
    try {
        const certificates = await Certificate.find()
            .sort({ issuedAt: -1 })
            .populate("userId", "name email courseName");

        res.status(200).json({
            success: true,
            count: certificates.length,
            data: certificates,
        });
    } catch (err) {
        next(err);
    }
};

// ── Helper: 3. Generate Certificate ID ────────────────────────────────────────
const generateCertificateId = async () => {
    const currentYear = new Date().getFullYear();
    const prefix = `BY8AI-${currentYear}-`;

    // Find the latest certificate for the current year
    const latestCert = await Certificate.findOne({
        certificateNumber: { $regex: `^${prefix}` }
    }).sort({ certificateNumber: -1 });

    let sequence = 1;
    if (latestCert) {
        // extract '0001' from 'BY8AI-2026-0001'
        const parts = latestCert.certificateNumber.split("-");
        const lastSequenceStr = parts[parts.length - 1]; // "0001"
        sequence = parseInt(lastSequenceStr, 10) + 1;
    }

    // Pad sequence to 4 digits (e.g., 0012)
    const paddedSequence = sequence.toString().padStart(4, "0");
    return `${prefix}${paddedSequence}`;
};

// ── 4. Create Certificate (Admin/HR) ──────────────────────────────────────────
exports.createCertificate = async (req, res, next) => {
    try {
        const { requestId, courseName, content, duration } = req.body;

        if (!requestId || !courseName) {
            return res.status(400).json({ success: false, message: "requestId and courseName are required" });
        }

        const request = await CertificateRequest.findById(requestId).populate("userId");
        if (!request) {
            return res.status(404).json({ success: false, message: "Certificate request not found" });
        }

        const user = request.userId;
        const finalCourseName = courseName || user.courseName || "Unknown Course";
        const finalDuration = duration || user.courseDuration || "";

        if (request.status === "Approved") {
            return res.status(400).json({ success: false, message: "This request has already been approved." });
        }

        // Generate ID
        const certificateNumber = await generateCertificateId();

        // Generate PDF to a temp file
        const tempDir = os.tmpdir();
        const fileName = `${certificateNumber}.pdf`;
        const tempFilePath = path.join(tempDir, fileName);

        // Format Date
        const issueDate = new Date().toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric"
        }); // DD/MM/YYYY

        const pdfData = {
            studentName: request.studentName,
            courseName: finalCourseName,
            certificateNumber,
            issueDate,
            content,
            duration: finalDuration
        };

        // Generate the PDF file
        await generateCertificate(pdfData, tempFilePath);

        // Upload to Cloudinary (as image so PDFs are publicly accessible)
        const cloudResult = await cloudinary.uploader.upload(tempFilePath, {
            resource_type: "image",
            type: "upload",
            access_mode: "public",
            folder: "certificates",
            public_id: certificateNumber,
        });

        // Clean up temp file
        if (fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
        }

        const fileUrl = cloudResult.secure_url;

        // Save DB Record
        const certificate = await Certificate.create({
            userId: user._id,
            requestId: request._id,
            certificateNumber,
            courseName: finalCourseName,
            content,
            duration: finalDuration,
            fileUrl,
        });

        // Update Request Status
        request.status = "Approved";
        await request.save();

        res.status(201).json({
            success: true,
            message: "Certificate generated successfully",
            data: certificate,
        });

    } catch (err) {
        next(err);
    }
};

// ── 5. Get Certificate Details (Student) ──────────────────────────────────────
exports.getCertificate = async (req, res, next) => {
    try {
        const { userId } = req.params;
        const certificates = await Certificate.find({ userId }).sort({ issuedAt: -1 });

        res.status(200).json({
            success: true,
            data: certificates, // A student can potentially have multiple certificates for different courses
        });
    } catch (err) {
        next(err);
    }
};

// ── 6. Download Certificate ────────────────────────────────────────────────
exports.downloadCertificate = async (req, res, next) => {
    try {
        const { certId } = req.params;
        console.log(certId, "<-cert");
        const certificate = await Certificate.findById(certId);

        if (!certificate) {
            return res.status(404).json({ success: false, message: "Certificate not found" });
        }

        // Generate a Signed URL to fetch even if the asset is restricted
        const publicId = `certificates/${certificate.certificateNumber}`;
        const signedUrl = cloudinary.url(publicId, {
            resource_type: "image", // We uploaded as image
            sign_url: true,
            secure: true
        });

        console.log("Fetching Signed URL:", signedUrl);

        // Fetch PDF from Cloudinary and stream it to the browser as a download
        const response = await axios({
            method: "get",
            url: signedUrl,
            responseType: "stream",
        });

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename=${certificate.certificateNumber}.pdf`);
        
        response.data.pipe(res);
    } catch (err) {
        console.error("Download Error:", err.message);
        res.status(err.response?.status || 500).json({
            success: false,
            message: err.message
        });
    }
};

// ── 7. View Certificate (Inline Browser Preview) ──────────────────────────────
exports.viewCertificate = async (req, res, next) => {
    try {
        const { certId } = req.params;

        console.log(certId, "<-cert");
        const certificate = await Certificate.findById(certId);
        console.log(certificate, "<-certificate");

        if (!certificate) {
            return res.status(404).json({ success: false, message: "Certificate not found" });
        }

        // Generate a Signed URL to fetch even if the asset is restricted
        const publicId = `certificates/${certificate.certificateNumber}`;
        const signedUrl = cloudinary.url(publicId, {
            resource_type: "image", // We uploaded as image
            sign_url: true,
            secure: true
        });

        console.log("Viewing Signed URL:", signedUrl);

        // Fetch PDF from Cloudinary and stream it directly to the browser
        const response = await axios({
            method: "get",
            url: signedUrl,
            responseType: "stream",
        });

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", "inline");

        response.data.pipe(res);
    } catch (err) { 
        console.log("View Error:", err.message);
        res.status(err.response?.status || 500).json({
            success: false,
            message: err.message
        });
    }
};
