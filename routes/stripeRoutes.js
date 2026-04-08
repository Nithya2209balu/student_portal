const express = require("express");
const router = express.Router();
const stripeController = require("../controllers/stripeController");
const { protect } = require("../middlewares/auth");

// POST /api/stripe/create-payment-intent (Temporarily unprotected for testing)
router.post("/create-payment-intent", stripeController.createPaymentIntent);

module.exports = router;
