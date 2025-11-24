import "dotenv/config";

import express from "express";
import cors from "cors";

import hotelsRouter from "./api/hotel";
import reviewRouter from "./api/review";
import locationsRouter from "./api/location";
import bookingRouter from "./api/booking";
import stripeWebhookRouter from "./api/stripe-webhook";
import globalErrorHandlingMiddleware from "./api/middleware/global-error-handling-middleware";

import connectDB from "./infrastructure/db";
import { clerkMiddleware } from "@clerk/express";

const app = express();

// Stripe webhook route MUST be before express.json() middleware
// because it needs raw body for signature verification
app.use("/api/stripe", stripeWebhookRouter);

// Parse JSON and text payloads (for all other routes)
app.use(express.json());
app.use(express.text());

// Enable CORS for frontend
app.use(
  cors({
    origin: "http://localhost:5173",
  })
);

// Clerk authentication middleware
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

// Global error handler
app.use(globalErrorHandlingMiddleware);

// Test route to ensure server is running
app.get("/test", (req, res) => {
  res.send("Server is running!");
});

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
