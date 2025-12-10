import "dotenv/config";

import express from "express";
import cors from "cors";
import { clerkMiddleware } from "@clerk/express";

import hotelsRouter from "./api/hotel";
import reviewRouter from "./api/review";
import locationsRouter from "./api/location";
import bookingRouter from "./api/booking";
import stripeWebhookRouter from "./api/stripe-webhook";
import globalErrorHandlingMiddleware from "./api/middleware/global-error-handling-middleware";

import connectDB from "./infrastructure/db";

const app = express();

// Allowed frontend origins (local dev + Netlify)
const allowedOrigins = [
  "http://localhost:5173",
  "https://smart-hotel-booking-frontend.netlify.app",
];

// CORS (runs for all routes)
app.use(
  cors({
    origin(origin, callback) {
      // allow requests with no origin (like mobile apps, curl, Stripe, etc.)
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

// Stripe webhook route MUST be before express.json() middleware
// because it needs raw body for signature verification
app.use("/api/stripe", stripeWebhookRouter);

// Parse JSON and text payloads (for all other routes)
app.use(express.json());
app.use(express.text());

// Clerk authentication middleware (runs for all protected routes)
app.use(clerkMiddleware());

// Optional: log every request for debugging
app.use((req, res, next) => {
  console.log(req.method, req.url);
  next();
});

// Mount routers
app.use("/api/hotels", hotelsRouter);
app.use("/api/reviews", reviewRouter);
app.use("/api/locations", locationsRouter);
app.use("/api/bookings", bookingRouter);

// Test route to ensure server is running
app.get("/test", (req, res) => {
  res.send("Server is running!");
});

// Global error handler (must be after routes)
app.use(globalErrorHandlingMiddleware);

// Connect to DB and start server
connectDB()
  .then(() => {
    const PORT = process.env.PORT || 8000;
    app.listen(PORT, () => {
      console.log(`Server is listening on PORT: ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to connect to DB:", err);
  });
