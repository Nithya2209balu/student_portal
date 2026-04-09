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

        // Generate a Stripe Checkout Session
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
            success_url: `myapp://payment-success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `myapp://payment-cancel`,
            metadata: {
                userId,
                courseId,
                amount: amount.toString()
            }
        });

        // Return the checkout URL to the frontend
        res.status(200).json({
            success: true,
            url: session.url, 
            amount: amount 
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

exports.handleWebhook = async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const { userId, courseId, amount } = session.metadata;

        try {
            const Payment = require("../models/Payment");
            
            // Check if this session has already been processed (idempotency)
            const existingPayment = await Payment.findOne({ "transactions.sessionId": session.id });
            if (existingPayment) {
                console.log(`Payment for session ${session.id} already processed.`);
                return res.json({ received: true });
            }

            // 1. Find existing payment record
            // Try strict match first, then fall back to most recent payment for user
            let payment = await Payment.findOne({ userId, courseId });
            if (!payment) {
                payment = await Payment.findOne({ userId }).sort({ createdAt: -1 });
            }
            
            // 2. Determine installment number by counting all transactions across all payment records for this user
            const allUserPayments = await Payment.find({ userId });
            let totalTransactionsCount = 0;
            allUserPayments.forEach(p => {
                totalTransactionsCount += (p.transactions ? p.transactions.length : 0);
            });

            const installmentNumber = totalTransactionsCount + 1;
            const numAmount = parseFloat(amount);

            if (!payment) {
                // If no payment record exists, fetch course details for total fees
                const Course = require("../models/Course");
                const course = await Course.findById(courseId);
                const totalFees = course ? (course.amount || course.fees || numAmount) : numAmount;

                const duration = 90; // Default duration
                const endDate = new Date();
                endDate.setDate(endDate.getDate() + duration);

                payment = new Payment({
                    userId,
                    courseId,
                    totalFees,
                    paidAmount: numAmount,
                    remainingAmount: Math.max(0, totalFees - numAmount),
                    durationInDays: duration,
                    endDate,
                    transactions: [{
                        amount: numAmount,
                        method: "online",
                        paymentType: "ONLINE",
                        installmentNumber,
                        sessionId: session.id,
                        paymentIntentId: session.payment_intent,
                        type: `Installment ${installmentNumber}`,
                        status: "success",
                        date: new Date()
                    }]
                });
            } else {
                payment.paidAmount += numAmount;
                payment.remainingAmount = Math.max(0, payment.totalFees - payment.paidAmount);
                payment.transactions.push({
                    amount: numAmount,
                    method: "online",
                    paymentType: "ONLINE",
                    installmentNumber,
                    sessionId: session.id,
                    paymentIntentId: session.payment_intent,
                    type: `Installment ${installmentNumber}`,
                    status: "success",
                    date: new Date()
                });
            }

            // Update status
            if (payment.remainingAmount <= 0) {
                payment.status = "paid";
            } else if (payment.paidAmount > 0) {
                payment.status = "partial";
            }

            await payment.save();
            console.log(`Payment successful for user ${userId}, session ${session.id}`);

        } catch (err) {
            console.error('Error processing webhook:', err.message);
            return res.status(500).json({ success: false, error: err.message });
        }
    }

    res.json({ received: true });
};