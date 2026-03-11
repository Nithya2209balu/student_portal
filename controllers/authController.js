const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const User = require("../models/User");

// ── helpers ───────────────────────────────────────────────────────────────────

const generateToken = (user) =>
    jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
        expiresIn: "30d",
    });

const generateOTP = () =>
    Math.floor(1000 + Math.random() * 9000).toString();

const sendOTPEmail = async (email, otp) => {
    const transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    });
    await transporter.sendMail({
        from: `"Student Portal" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "Your OTP – Student Portal",
        html: `<p>Your OTP is <strong>${otp}</strong>. It expires in 10 minutes.</p>`,
    });
};

const sanitizeUser = (user) => ({
    _id: user._id,
    name: user.name,
    email: user.email,
    mobile: user.mobile,
    studentType: user.studentType,
    courseName: user.courseName,
    role: user.role,
    isApproved: user.isApproved,
});

// ── controllers ───────────────────────────────────────────────────────────────

/**
 * POST /api/auth/register
 */
exports.register = async (req, res, next) => {
    try {
        const { name, email, mobile, password, confirmPassword, studentType, courseName } = req.body;

        if (!name || !email || !mobile || !password || !confirmPassword || !studentType)
            return res.status(400).json({ success: false, message: "All fields are required" });

        if (password !== confirmPassword)
            return res.status(400).json({ success: false, message: "Passwords do not match" });

        if (studentType === "offline" && !courseName)
            return res.status(400).json({ success: false, message: "Course title is required for offline students" });

        const existing = await User.findOne({ email });
        if (existing)
            return res.status(400).json({ success: false, message: "Email already registered" });

        const user = await User.create({ name, email, mobile, password, studentType, courseName });

        res.status(201).json({
            success: true,
            message: "Registration successful",
            data: sanitizeUser(user),
        });
    } catch (err) {
        next(err);
    }
};

/**
 * POST /api/auth/login
 * Body: { identifier (email or mobile), password, fcmToken }
 */
exports.login = async (req, res, next) => {
    try {
        const { identifier, password, fcmToken } = req.body;
        if (!identifier || !password)
            return res.status(400).json({ success: false, message: "Identifier and password are required" });

        // Match by email or mobile
        const user = await User.findOne({
            $or: [{ email: identifier.toLowerCase() }, { mobile: identifier }],
        });
        if (!user)
            return res.status(401).json({ success: false, message: "Invalid credentials" });

        const isMatch = await user.matchPassword(password);
        if (!isMatch)
            return res.status(401).json({ success: false, message: "Invalid credentials" });

        // Block unapproved students (admins can always log in)
        if (user.role === "student" && !user.isApproved)
            return res.status(403).json({
                success: false,
                message: "Your account is pending admin approval. Please wait for approval before logging in.",
            });

        // Store FCM token
        if (fcmToken) { user.fcmToken = fcmToken; await user.save(); }

        res.json({
            success: true,
            message: "Login successful",
            token: generateToken(user),
            data: sanitizeUser(user),
        });
    } catch (err) {
        next(err);
    }
};

/**
 * POST /api/auth/forgot-password
 * Body: { email }
 */
exports.forgotPassword = async (req, res, next) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ success: false, message: "Email is required" });

        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) return res.status(404).json({ success: false, message: "No account found with this email" });

        const otp = generateOTP();
        user.otp = otp;
        user.otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 min
        await user.save();

        await sendOTPEmail(email, otp);

        res.json({ success: true, message: "OTP sent to your email" });
    } catch (err) {
        next(err);
    }
};

/**
 * POST /api/auth/verify-otp
 * Body: { email, otp }
 */
exports.verifyOTP = async (req, res, next) => {
    try {
        const { email, otp } = req.body;
        if (!email || !otp)
            return res.status(400).json({ success: false, message: "Email and OTP are required" });

        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user || user.otp !== otp || new Date() > user.otpExpiry)
            return res.status(400).json({ success: false, message: "Invalid or expired OTP" });

        // Clear OTP after verification
        user.otp = undefined;
        user.otpExpiry = undefined;
        await user.save();

        res.json({ success: true, message: "OTP verified successfully" });
    } catch (err) {
        next(err);
    }
};

/**
 * POST /api/auth/login-with-otp
 * Body: { email, fcmToken }  → sends OTP first if not verified
 * Two-step: step 1 – send OTP, step 2 – verify OTP and return token
 * Use forgot-password + verify-otp then call this with verified flag
 *
 * For OTP login flow:
 *   1. POST /api/auth/forgot-password  { email }      → OTP sent
 *   2. POST /api/auth/login-with-otp   { email, otp, fcmToken } → JWT returned
 */
exports.loginWithOTP = async (req, res, next) => {
    try {
        const { email, otp, fcmToken } = req.body;
        if (!email || !otp)
            return res.status(400).json({ success: false, message: "Email and OTP are required" });

        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user || user.otp !== otp || new Date() > user.otpExpiry)
            return res.status(400).json({ success: false, message: "Invalid or expired OTP" });

        user.otp = undefined;
        user.otpExpiry = undefined;
        if (fcmToken) user.fcmToken = fcmToken;
        await user.save();

        // Block unapproved students
        if (user.role === "student" && !user.isApproved)
            return res.status(403).json({
                success: false,
                message: "Your account is pending admin approval. Please wait for approval before logging in.",
            });

        res.json({
            success: true,
            message: "OTP login successful",
            token: generateToken(user),
            data: sanitizeUser(user),
        });
    } catch (err) {
        next(err);
    }
};

// ── Admin Controllers ─────────────────────────────────────────────────────────

/**
 * GET /api/admin/students/pending
 * Returns all students awaiting approval.
 */
exports.listPendingStudents = async (req, res, next) => {
    try {
        const students = await User.find({ role: "student", isApproved: false })
            .select("-password -otp -otpExpiry -fcmToken")
            .sort({ createdAt: -1 });
        res.json({ success: true, count: students.length, data: students });
    } catch (err) {
        next(err);
    }
};

/**
 * GET /api/admin/students
 * Returns all students (approved + pending).
 */
exports.listAllStudents = async (req, res, next) => {
    try {
        const students = await User.find({ role: "student" })
            .select("-password -otp -otpExpiry -fcmToken")
            .sort({ createdAt: -1 });
        res.json({ success: true, count: students.length, data: students });
    } catch (err) {
        next(err);
    }
};

/**
 * PATCH /api/admin/students/:id/approve
 * Approves a student account.
 */
exports.approveStudent = async (req, res, next) => {
    try {
        const student = await User.findById(req.params.id);
        if (!student || student.role !== "student")
            return res.status(404).json({ success: false, message: "Student not found" });

        student.isApproved = true;
        await student.save();

        res.json({ success: true, message: "Student account approved", data: sanitizeUser(student) });
    } catch (err) {
        next(err);
    }
};

/**
 * PATCH /api/admin/students/:id/reject
 * Rejects (and deletes) a student account.
 */
exports.rejectStudent = async (req, res, next) => {
    try {
        const student = await User.findById(req.params.id);
        if (!student || student.role !== "student")
            return res.status(404).json({ success: false, message: "Student not found" });

        await student.deleteOne();

        res.json({ success: true, message: "Student account rejected and removed" });
    } catch (err) {
        next(err);
    }
};
