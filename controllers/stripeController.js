const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.createPaymentIntent = async (req, res, next) => {
    try {
        const { amount, productName, userId, courseId } = req.body;

        if (!amount || !productName || !userId || !courseId) {
            return res.status(400).json({ 
                success: false, 
                message: "Missing required fields" 
            });
        }

        // Generate a Stripe Checkout Session instead of a Payment Intent
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'inr',
                        product_data: {
                            name: productName,
                        },
                        unit_amount: Math.round(amount * 100),
                    },
                    quantity: 1,
                },
            ],
            mode: 'payment',
            // Update these URLs to where your app should route after payment
            success_url: `https://your-success-url.com/success`, // Usually a deep link to your app like myapp://payment-success
            cancel_url: `https://your-cancel-url.com/cancel`,
            metadata: {
                userId,
                courseId
            }
        });

        // Return the checkout URL to the frontend
        res.status(200).json({
            success: true,
            url: session.url, 
        });
    } catch (err) {
        console.error("Stripe Error:", err.message);
        res.status(500).json({ 
            success: false, 
            message: "Failed to create checkout session",
            error: err.message
        });
    }
};