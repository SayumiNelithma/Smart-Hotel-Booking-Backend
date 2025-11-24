import { stripe } from "./stripe";

/**
 * Creates a Stripe product and price for a hotel
 * @param hotelName - Name of the hotel
 * @param hotelDescription - Description of the hotel
 * @param pricePerNight - Price per night in USD (e.g., 100.00)
 * @returns Object containing productId and priceId
 */
export const createStripeProductAndPrice = async (
  hotelName: string,
  hotelDescription: string,
  pricePerNight: number
): Promise<{ productId: string; priceId: string }> => {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }

  // Create Stripe product
  const product = await stripe.products.create({
    name: hotelName,
    description: hotelDescription,
    metadata: {
      type: "hotel",
    },
  });

  // Create Stripe price (price per night in cents)
  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: Math.round(pricePerNight * 100), // Convert to cents
    currency: "usd",
    metadata: {
      type: "per_night",
    },
  });

  return {
    productId: product.id,
    priceId: price.id,
  };
};

