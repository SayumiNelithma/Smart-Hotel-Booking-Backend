import Stripe from "stripe";
import { config } from "dotenv";

config();

// Validate Stripe key on module load
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  console.error("⚠️ STRIPE_SECRET_KEY is not set in environment variables");
  console.error("   Please add STRIPE_SECRET_KEY to your Backend/.env file");
} else {
  // Validate key format
  if (!stripeSecretKey.startsWith("sk_test_") && !stripeSecretKey.startsWith("sk_live_")) {
    console.warn("⚠️ STRIPE_SECRET_KEY doesn't match expected format (should start with sk_test_ or sk_live_)");
  } else {
    const keyType = stripeSecretKey.startsWith("sk_test_") ? "TEST" : "LIVE";
    console.log(`✅ Stripe ${keyType} key loaded successfully`);
  }
}

// Initialize Stripe client (will throw error if key is invalid when used)
export const stripe = stripeSecretKey 
  ? new Stripe(stripeSecretKey, {
      apiVersion: "2024-12-18.acacia", // Use a valid Stripe API version
    })
  : null as any; // Type assertion to allow import, but will fail at runtime if used

