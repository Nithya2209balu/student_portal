const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// ── Create Payment Intent ────────────────────────────────────────────────────
exports.createPaymentIntent = async (req, res, next) => {
    try {
        const { amount, productName, userId, courseId } = req.body;

        if (!amount || !productName || !userId || !courseId) {
            return res.status(400).json({ 
                success: false, 
                message: "Missing required fields (amount, productName, userId, courseId)" 
            });
        }

        // Create a PaymentIntent with the specific amount and currency
        // Stripe expects amount in smallest currency unit (e.g., paise for INR, cents for USD)
        // Assuming amount is sent in major unit (e.g., rupees), multiply by 100
        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(amount * 100), 
            currency: 'inr', // Change currency as needed based on your app
            metadata: {
                productName,
                userId,
                courseId
            },
            // Enable automatic payment methods
            automatic_payment_methods: {
                enabled: true,
            },
        });

        res.status(200).json({
            success: true,
            clientSecret: paymentIntent.client_secret,
        });
    } catch (err) {
        console.error("Stripe Error:", err.message);
        res.status(500).json({ 
            success: false, 
            message: "Failed to create payment intent",
            error: err.message
        });
    }
};
