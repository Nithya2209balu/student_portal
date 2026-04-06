const express = require("express");
const router = express.Router();
const stripeController = require("../controllers/stripeController");
const { protect } = require("../middlewares/auth");

// POST /api/stripe/create-payment-intent
router.post("/create-payment-intent", protect, stripeController.createPaymentIntent);

module.exports = router;
