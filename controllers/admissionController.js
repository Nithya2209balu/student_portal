const Admission = require("../models/Admission");
const User = require("../models/User");
const Course = require("../models/Course");

/**
 * Helper to send Admission confirmation email via Brevo
 */
const sendAdmissionEmail = async (studentName, email, course, password) => {
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
            subject: "Admission Confirmation",
            htmlContent: `
                <p>Hello ${studentName},</p>
                <p>Your admission has been successfully completed.</p>
                <p><strong>Course:</strong> ${course}</p>
                <br/>
                <p><strong>Login Credentials:</strong><br/>
                Email: ${email}<br/>
                Password: ${password}</p>
                <br/>
                <p>You can now log in to your student dashboard.</p>
                <p>Thank you!</p>
            `
        })
    });

    if (!response.ok) {
        const errorData = await response.json();
        console.error("Brevo email error:", errorData);
        // We don't throw here to avoid failing the whole request if email fails, 
        // but in a production app you might want to handle this more strictly.
    } else {
        const data = await response.json();
        console.log("Admission email sent, messageId:", data.messageId);
    }
};

/**
 * POST /api/admissions
 */
exports.createAdmission = async (req, res, next) => {
    try {
        const { name, course, phone, email, password } = req.body;

        // 1. Validate fields
        if (!name || !course || !phone || !email || !password) {
            return res.status(400).json({ success: false, message: "All fields are required" });
        }

        // 2. Check if email already exists in User record
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.status(400).json({ success: false, message: "Email already registered" });
        }

        // 3. Try to find course details to Link to User
        const matchedCourse = await Course.findOne({ title: new RegExp(`^${course}$`, 'i') });
        
        // 4. Create Admission record
        const admission = await Admission.create({
            name,
            course,
            phone,
            email,
            status: "completed"
        });

        // 5. Create User record (Student)
        // Note: Password hashing is handled by User model pre-save hook
        const user = await User.create({
            name,
            email,
            mobile: phone,
            password: password,
            studentType: "online", // Defaulting to online for API adms
            courseName: course,
            courseId: matchedCourse ? matchedCourse.courseId : undefined,
            role: "student",
            isApproved: true // Auto-approved as they get login credentials immediately
        });

        // 6. Send Confirmation Email
        await sendAdmissionEmail(name, email, course, password);

        res.status(201).json({
            success: true,
            message: "Admission process completed successfully",
            data: {
                admissionId: admission._id,
                userId: user._id,
                name: user.name,
                email: user.email
            }
        });

    } catch (err) {
        next(err);
    }
};
