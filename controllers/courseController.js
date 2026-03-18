const CourseCategory = require("../models/CourseCategory");
const Course = require("../models/Course");
const Lesson = require("../models/Lesson");
const Enrollment = require("../models/Enrollment");
const Doubt = require("../models/Doubt");
const Note = require("../models/Note");
const MCQ = require("../models/MCQ");
const QuizScore = require("../models/QuizScore");

// ── Categories ────────────────────────────────────────────────────────────────

// Map of fixed numeric IDs to category names
const CATEGORY_CODE_MAP = { 1001: "AI", 1002: "Web Development" };

// Helper to flatten the category response
const formatCategoryResponse = (cat) => ({
    _id: cat._id,
    name: cat.name,
    description: cat.description,
    imageUrl: cat.imageUrl,
    fees: cat.fees,
    categoryCode: cat.categoryCode || (cat.parentCategoryId ? cat.parentCategoryId.categoryCode : null)
});

exports.getCategories = async (req, res, next) => {
    try {
        const categories = await CourseCategory.find()
            .sort({ name: 1 })
            .populate("parentCategoryId", "categoryCode");
            
        const simplified = categories.map(formatCategoryResponse);
        res.json({ success: true, data: simplified });
    } catch (err) { next(err); }
};

/**
 * POST /api/courses/categories/names
 * Returns the list of base category names (no body needed)
 */
exports.postCategoryNames = async (req, res, next) => {
    try {
        const categories = await CourseCategory.find(
            { categoryCode: { $in: [1001, 1002] } },
            "name categoryCode"
        ).sort({ categoryCode: 1 });
        res.json({ success: true, data: categories.map(c => c.name) });
    } catch (err) { next(err); }
};

exports.createCategory = async (req, res, next) => {
    try {
        const { name, description, imageUrl, fees, categoryId } = req.body;
        if (!name) return res.status(400).json({ success: false, message: "Category name is required" });
        if (!categoryId) return res.status(400).json({ success: false, message: "categoryId is required (1001 for AI, 1002 for Web Development)" });

        const numericId = Number(categoryId);
        if (![1001, 1002].includes(numericId)) {
            return res.status(400).json({ success: false, message: "Invalid categoryId. Use 1001 for AI or 1002 for Web Development" });
        }

        // Check duplicate category name
        const existing = await CourseCategory.findOne({ name: { $regex: new RegExp(`^${name}$`, "i") } });
        if (existing) return res.status(400).json({ success: false, message: "Category already exists" });

        // Find the parent category doc by its fixed code
        const parent = await CourseCategory.findOne({ categoryCode: numericId });
        if (!parent) return res.status(400).json({ success: false, message: `Parent category (${CATEGORY_CODE_MAP[numericId]}) not found in DB` });

        const category = await CourseCategory.create({
            name,
            description,
            imageUrl,
            fees: fees || 0,
            parentCategoryId: parent._id,
        });

        const populated = await category.populate("parentCategoryId", "categoryCode");
        res.status(201).json({ 
            success: true, 
            message: "Category created successfully", 
            data: formatCategoryResponse(populated) 
        });
    } catch (err) { next(err); }
};

// ── Courses List ──────────────────────────────────────────────────────────────
exports.getCourses = async (req, res, next) => {
    try {
        const { categoryId } = req.query;
        const filter = { isActive: true };
        if (categoryId) filter.categoryId = categoryId;

        const courses = await Course.find(filter)
            .populate("categoryId", "name")
            .select("title imageUrl amount reviewsCount avgRating tutorName categoryId")
            .sort({ createdAt: -1 });

        res.json({ success: true, data: courses });
    } catch (err) { next(err); }
};

// ── Course About ──────────────────────────────────────────────────────────────
exports.getCourseAbout = async (req, res, next) => {
    try {
        const course = await Course.findById(req.params.id).populate("categoryId", "name");
        if (!course) return res.status(404).json({ success: false, message: "Course not found" });

        res.json({
            success: true,
            data: {
                _id: course._id,
                title: course.title,
                description: course.description,
                imageUrl: course.imageUrl,
                amount: course.amount,
                reviewsCount: course.reviewsCount,
                avgRating: course.avgRating,
                category: course.categoryId,
                tutor: {
                    name: course.tutorName,
                    role: course.tutorRole,
                    image: course.tutorImage,
                },
            },
        });
    } catch (err) { next(err); }
};

// ── Enroll (Payment Placeholder) ──────────────────────────────────────────────
exports.enrollCourse = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const courseId = req.params.id;
        const { paymentId, amount } = req.body; // from payment gateway response

        const course = await Course.findById(courseId);
        if (!course) return res.status(404).json({ success: false, message: "Course not found" });

        const existing = await Enrollment.findOne({ userId, courseId });
        if (existing) return res.status(400).json({ success: false, message: "Already enrolled in this course" });

        const enrollment = await Enrollment.create({
            userId,
            courseId,
            paymentStatus: paymentId ? "paid" : "pending",
            paymentId: paymentId || null,
            amount: amount || course.amount,
        });

        res.status(201).json({ success: true, message: "Enrolled successfully", data: enrollment });
    } catch (err) { next(err); }
};

// ── Lessons ───────────────────────────────────────────────────────────────────
exports.getCourseLessons = async (req, res, next) => {
    try {
        const lessons = await Lesson.find({ courseId: req.params.id }).sort({ order: 1 });
        res.json({ success: true, data: lessons });
    } catch (err) { next(err); }
};

// ── Doubts: Ask ───────────────────────────────────────────────────────────────
exports.askDoubt = async (req, res, next) => {
    try {
        const { description } = req.body;
        if (!description) return res.status(400).json({ success: false, message: "Description is required" });

        const doubt = await Doubt.create({
            userId: req.user.id,
            courseId: req.params.id,
            description,
        });
        res.status(201).json({ success: true, message: "Doubt posted", data: doubt });
    } catch (err) { next(err); }
};

// ── Doubts: List ──────────────────────────────────────────────────────────────
exports.getDoubts = async (req, res, next) => {
    try {
        const doubts = await Doubt.find({ courseId: req.params.id })
            .populate("userId", "name email")
            .sort({ createdAt: -1 });
        res.json({ success: true, data: doubts });
    } catch (err) { next(err); }
};

// ── Notes: Store ──────────────────────────────────────────────────────────────
exports.storeNote = async (req, res, next) => {
    try {
        const { content, lessonId } = req.body;
        if (!content) return res.status(400).json({ success: false, message: "Content is required" });

        const note = await Note.create({
            userId: req.user.id,
            courseId: req.params.id,
            lessonId: lessonId || null,
            content,
        });
        res.status(201).json({ success: true, message: "Note saved", data: note });
    } catch (err) { next(err); }
};

// ── Notes: List ───────────────────────────────────────────────────────────────
exports.getNotes = async (req, res, next) => {
    try {
        const notes = await Note.find({ userId: req.user.id, courseId: req.params.id })
            .sort({ createdAt: -1 });
        res.json({ success: true, data: notes });
    } catch (err) { next(err); }
};

// ── MCQ: Get 5 questions for a lesson ────────────────────────────────────────
exports.getLessonMCQ = async (req, res, next) => {
    try {
        const { lessonId } = req.params;
        const mcqs = await MCQ.find({ lessonId })
            .limit(5)
            .select("-correctOption"); // hide correct answer from client

        res.json({ success: true, total: mcqs.length, data: mcqs });
    } catch (err) { next(err); }
};

// ── Quiz: Submit answers + save score ────────────────────────────────────────
exports.submitQuiz = async (req, res, next) => {
    try {
        const { lessonId } = req.params;
        const { courseId, answers } = req.body;
        // answers: [{ mcqId, selectedOption }]

        if (!Array.isArray(answers) || answers.length === 0)
            return res.status(400).json({ success: false, message: "Answers array is required" });

        // Fetch MCQs with correct answers
        const mcqIds = answers.map((a) => a.mcqId);
        const mcqs = await MCQ.find({ _id: { $in: mcqIds } });
        const mcqMap = Object.fromEntries(mcqs.map((m) => [m._id.toString(), m]));

        let score = 0;
        const evaluated = answers.map((a) => {
            const mcq = mcqMap[a.mcqId];
            const isCorrect = mcq && mcq.correctOption === a.selectedOption;
            if (isCorrect) score++;
            return { mcqId: a.mcqId, selectedOption: a.selectedOption, isCorrect };
        });

        const quizScore = await QuizScore.create({
            userId: req.user.id,
            lessonId,
            courseId,
            score,
            total: answers.length,
            answers: evaluated,
        });

        res.json({
            success: true,
            message: "Quiz submitted",
            data: {
                score,
                total: answers.length,
                percentage: Math.round((score / answers.length) * 100),
                details: evaluated,
                quizScoreId: quizScore._id,
            },
        });
    } catch (err) { next(err); }
};

// ── Quiz Scores: Get for a lesson ─────────────────────────────────────────────
exports.getLessonQuizScores = async (req, res, next) => {
    try {
        const { lessonId } = req.params;
        const scores = await QuizScore.find({ userId: req.user.id, lessonId })
            .sort({ takenAt: -1 });
        res.json({ success: true, data: scores });
    } catch (err) { next(err); }
};
