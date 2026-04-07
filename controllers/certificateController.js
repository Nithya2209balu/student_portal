const CertificateRequest = require("../models/CertificateRequest");
const Certificate = require("../models/Certificate");
const User = require("../models/User");
const { generateCertificate } = require("../utils/pdfGenerator");
const path = require("path");
const fs = require("fs");

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

        const requests = await CertificateRequest.find(query).sort({ createdAt: -1 }).populate("userId", "name email");

        res.status(200).json({
            success: true,
            count: requests.length,
            data: requests,
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

        const request = await CertificateRequest.findById(requestId);
        if (!request) {
            return res.status(404).json({ success: false, message: "Certificate request not found" });
        }

        if (request.status === "Approved") {
            return res.status(400).json({ success: false, message: "This request has already been approved." });
        }

        // Generate ID
        const certificateNumber = await generateCertificateId();
        
        // Prepare PDF path
        const fileName = `${certificateNumber}.pdf`;
        // Keeping in uploads/docs to match existing static serving config
        const fileDir = path.join(__dirname, "..", "uploads", "docs", "certificates"); 
        const filePath = path.join(fileDir, fileName);
        const fileUrl = `uploads/docs/certificates/${fileName}`;

        // Format Date
        const issueDate = new Date().toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric"
        }); // DD/MM/YYYY

        const pdfData = {
            studentName: request.studentName,
            courseName,
            certificateNumber,
            issueDate,
            content,
            duration
        };

        // Generate the PDF file asynchronously
        await generateCertificate(pdfData, filePath);

        // Save DB Record
        const certificate = await Certificate.create({
            userId: request.userId,
            requestId: request._id,
            certificateNumber,
            courseName,
            content,
            duration,
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

// ── 6. Download Certificate (Secure) ──────────────────────────────────────────
exports.downloadCertificate = async (req, res, next) => {
    try {
        const { certId } = req.params;
        const loggedInUserId = req.user.id;

        const certificate = await Certificate.findById(certId);
        if (!certificate) {
            return res.status(404).json({ success: false, message: "Certificate not found" });
        }

        // Security: Ensure only the owner can download it
        if (certificate.userId.toString() !== loggedInUserId) {
            return res.status(403).json({ success: false, message: "Unauthorized to download this certificate." });
        }

        const absolutePath = path.join(__dirname, "..", certificate.fileUrl);
        if (fs.existsSync(absolutePath)) {
            res.download(absolutePath, `${certificate.certificateNumber}.pdf`);
        } else {
            res.status(404).json({ success: false, message: "PDF file not found on disk." });
        }
    } catch (err) {
        next(err);
    }
};
