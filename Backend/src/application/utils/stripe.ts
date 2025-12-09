import Stripe from "stripe";
import { config } from "dotenv";

config();

// Read Stripe key from env
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  console.error("⚠️ STRIPE_SECRET_KEY is not set in environment variables");
  console.error("   Please add STRIPE_SECRET_KEY to your Backend/.env file or Render env vars");
  // Fail fast so we don't run the app without Stripe configured
  throw new Error("STRIPE_SECRET_KEY is required to initialize Stripe");
} else {
  // Optional: basic format check
  if (!stripeSecretKey.startsWith("sk_test_") && !stripeSecretKey.startsWith("sk_live_")) {
    console.warn(
      "⚠️ STRIPE_SECRET_KEY doesn't match expected format (should start with sk_test_ or sk_live_)"
    );
  } else {
    const keyType = stripeSecretKey.startsWith("sk_test_") ? "TEST" : "LIVE";
    console.log(`✅ Stripe ${keyType} key loaded successfully`);
  }
}

// Initialize Stripe client
export const stripe = new Stripe(stripeSecretKey, {
  // This must match the literal type expected by your installed `stripe` package
  apiVersion: "2025-10-29.clover",
  // If you prefer to be explicit about types:
  // apiVersion: "2025-10-29.clover" as Stripe.LatestApiVersion,
});
