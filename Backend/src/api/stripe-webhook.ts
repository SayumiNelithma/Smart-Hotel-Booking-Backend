import express from "express";
import { stripe } from "../application/utils/stripe";
import Booking from "../infrastructure/entities/Booking";

const router = express.Router();

// Important: use raw body for Stripe signature verification
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"] as string;

    if (!sig) {
      console.error("Missing stripe-signature header");
      return res.status(400).send("Missing stripe-signature header");
    }

    let event;

    try {
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
      if (!webhookSecret) {
        console.error("STRIPE_WEBHOOK_SECRET is not configured");
        return res.status(500).send("Webhook secret not configured");
      }

      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        webhookSecret
      );
    } catch (err: any) {
      console.error("Webhook signature verification failed", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle payment success events
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as any;
      const bookingId = session.metadata?.bookingId;

      console.log("Processing checkout.session.completed event:", {
        sessionId: session.id,
        paymentStatus: session.payment_status,
        bookingId: bookingId,
      });

      if (bookingId) {
        try {
          // Only update to PAID if payment was actually successful
          if (session.payment_status === "paid") {
            const booking = await Booking.findByIdAndUpdate(
              bookingId,
              {
                status: "PAID",
                paymentStatus: "PAID",
              },
              { new: true }
            );

            if (booking) {
              console.log(`✅ Booking ${bookingId} updated to PAID status`);
            } else {
              console.warn(`⚠️ Booking ${bookingId} not found`);
            }
          } else {
            console.warn(`⚠️ Payment not completed for booking ${bookingId}. Payment status: ${session.payment_status}`);
          }
        } catch (error) {
          console.error(`❌ Error updating booking ${bookingId}:`, error);
          // Don't return error to Stripe - we'll handle it manually
        }
      } else {
        console.warn("⚠️ checkout.session.completed event missing bookingId in metadata");
      }
    }

    // Handle payment failure events
    if (event.type === "checkout.session.async_payment_failed") {
      const session = event.data.object as any;
      const bookingId = session.metadata?.bookingId;

      console.log("Processing checkout.session.async_payment_failed event:", {
        sessionId: session.id,
        bookingId: bookingId,
      });

      if (bookingId) {
        try {
          const booking = await Booking.findByIdAndUpdate(
            bookingId,
            {
              paymentStatus: "FAILED",
            },
            { new: true }
          );

          if (booking) {
            console.log(`⚠️ Booking ${bookingId} payment marked as FAILED`);
          }
        } catch (error) {
          console.error(`❌ Error updating booking ${bookingId} payment status:`, error);
        }
      }
    }

    // Return a response to acknowledge receipt of the event
    res.json({ received: true });
  }
);

export default router;

