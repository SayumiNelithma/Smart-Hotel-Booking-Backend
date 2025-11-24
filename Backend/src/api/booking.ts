import express from "express";
import isAuthenticated from "./middleware/authentication-middleware";
import { 
  createBooking, 
  getMyBookings, 
  getAllBookings, 
  cancelBooking, 
  updateBooking, 
  getBookingById,
  getBookingBySessionId,
  confirmBooking,
  updateBookingStatus
} from "../application/booking";

const bookingRouter = express.Router();

// Test route
bookingRouter.get("/test", (req, res) => {
  res.json({ message: "Booking router is working!" });
});

// Stripe configuration diagnostic route
bookingRouter.get("/stripe-check", async (req, res) => {
  const { stripe } = await import("../application/utils/stripe");
  
  const diagnostics: any = {
    stripeSecretKey: {
      exists: !!process.env.STRIPE_SECRET_KEY,
      startsWith: process.env.STRIPE_SECRET_KEY?.substring(0, 8) || "N/A",
      length: process.env.STRIPE_SECRET_KEY?.length || 0,
      isValidFormat: process.env.STRIPE_SECRET_KEY?.startsWith("sk_test_") || process.env.STRIPE_SECRET_KEY?.startsWith("sk_live_") || false,
    },
    frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",
    stripeClient: {
      initialized: !!stripe,
    },
    timestamp: new Date().toISOString(),
  };
  
  // Test Stripe connection if key exists
  if (diagnostics.stripeSecretKey.exists && stripe) {
    try {
      // Simple API call to verify connection
      await stripe.products.list({ limit: 1 });
      diagnostics.stripeConnection = "✅ Connected";
    } catch (error: any) {
      diagnostics.stripeConnection = `❌ Error: ${error.message}`;
    }
  } else {
    diagnostics.stripeConnection = "⚠️ Cannot test - Stripe not initialized";
  }
  
  res.json({
    message: "Stripe Configuration Diagnostics",
    diagnostics,
    status: diagnostics.stripeSecretKey.exists ? "✅ Configured" : "❌ Not Configured",
  });
});

// Create booking (authenticated users)
bookingRouter.post("/", isAuthenticated, createBooking);

// Get bookings of the logged-in user
bookingRouter.get("/me", isAuthenticated, getMyBookings);

// Get all bookings (public)
bookingRouter.get("/", getAllBookings);

// Get booking by Stripe session ID (for payment confirmation)
bookingRouter.get("/session/:sessionId", getBookingBySessionId);

// Get specific booking by ID (authenticated users) - MUST be after /me route
bookingRouter.get("/:bookingId", isAuthenticated, getBookingById);

// Cancel a booking (authenticated users)
bookingRouter.patch("/:bookingId/cancel", isAuthenticated, cancelBooking);

// Update a booking (authenticated users)
bookingRouter.patch("/:bookingId", isAuthenticated, updateBooking);

// Admin routes (no authentication for now - in production, add admin middleware)
// Confirm booking (admin only)
bookingRouter.patch("/:bookingId/confirm", confirmBooking);

// Update booking status (admin only)
bookingRouter.patch("/:bookingId/status", updateBookingStatus);

export default bookingRouter;
