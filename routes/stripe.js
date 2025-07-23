import express from "express";
import Stripe from "stripe";

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_TEST_KEY);

router.post("/create-checkout-session", async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: req.body.name || "Test Product",
            },
            unit_amount: req.body.amount || 5000,
          },
          quantity: 1,
        },
      ],
      success_url: `http://localhost:${process.env.PORT}/success`,
      cancel_url: `http://localhost:${process.env.PORT}/cancel`,
    });

    res.json({ id: session.id });
  } catch (err) {
    console.error(err);
    res.status(500).send("Something went wrong");
  }
});

export default router;
