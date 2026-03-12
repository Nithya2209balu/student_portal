const jwt = require("jsonwebtoken");
const User = require("../models/User");

// ── helpers ───────────────────────────────────────────────────────────────────

const generateToken = (user, rememberMe = false) =>
    jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
        expiresIn: rememberMe ? "30d" : "1d",
    });

const generateOTP = () =>
    Math.floor(1000 + Math.random() * 9000).toString();

const sendOTPEmail = async (email, otp) => {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
            "api-key": process.env.BREVO_API_KEY,
            "content-type": "application/json",
            "accept": "application/json"
        },
        body: JSON.stringify({
            sender: { name: "Student Portal", email: process.env.BREVO_FROM_EMAIL },
            to: [{ email }],
            subject: "Your OTP – Student Portal",
            htmlContent: `<p>Your OTP is <strong>${otp}</strong>. It expires in 10 minutes.</p>`
        })
    });

    if (!response.ok) {
        const errorData = await response.json();
        console.error("Brevo email error:", errorData);
        throw new Error(errorData.message || "Failed to send OTP email");
    }

    const data = await response.json();
    console.log("OTP email sent, messageId:", data.messageId);
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
        const { identifier, password, fcmToken, rememberMe } = req.body;
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
            token: generateToken(user, rememberMe),
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

        const resetToken = require("crypto").randomBytes(32).toString("hex");

        // Clear OTP after verification and set reset flow token
        user.otp = undefined;
        user.otpExpiry = undefined;
        user.resetToken = resetToken;
        user.resetTokenExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 mins
        await user.save();

        res.json({ success: true, message: "OTP verified successfully", resetToken });
    } catch (err) {
        next(err);
    }
};

/**
 * POST /api/auth/reset-password
 * Body: { email, newPassword }
 */
exports.resetPassword = async (req, res, next) => {
    try {
        const { email, newPassword } = req.body;
        if (!email || !newPassword)
            return res.status(400).json({ success: false, message: "Email and new password are required" });

        const user = await User.findOne({ email: email.toLowerCase() });

        if (!user)
            return res.status(404).json({ success: false, message: "User not found" });

        // Update password (hashing happens automatically via mongoose pre-save hook)
        user.password = newPassword;
        // Also clear resetToken just in case one was left behind
        user.resetToken = undefined;
        user.resetTokenExpiry = undefined;
        await user.save();

        res.json({ success: true, message: "Password reset successfully. You can now log in." });
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
        const { email, otp, fcmToken, rememberMe } = req.body;
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
            token: generateToken(user, rememberMe),
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
