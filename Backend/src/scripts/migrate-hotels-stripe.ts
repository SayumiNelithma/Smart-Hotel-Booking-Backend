import "dotenv/config";
import connectDB from "../infrastructure/db";
import Hotel from "../infrastructure/entities/Hotel";
import { createStripeProductAndPrice } from "../application/utils/stripe-hotel";

/**
 * Migration script to add Stripe product and price IDs to existing hotels
 * Run with: npx ts-node src/scripts/migrate-hotels-stripe.ts
 */
const migrateHotelsToStripe = async () => {
  try {
    // Connect to database
    await connectDB();
    console.log("Connected to database");

    // Find all hotels without Stripe product/price IDs
    const hotelsWithoutStripe = await Hotel.find({
      $or: [
        { stripeProductId: { $exists: false } },
        { stripePriceId: { $exists: false } },
        { stripeProductId: null },
        { stripePriceId: null },
      ],
    });

    console.log(`Found ${hotelsWithoutStripe.length} hotels without Stripe IDs`);

    if (hotelsWithoutStripe.length === 0) {
      console.log("All hotels already have Stripe IDs. Migration complete!");
      process.exit(0);
    }

    // Check if Stripe is configured
    if (!process.env.STRIPE_SECRET_KEY) {
      console.error("ERROR: STRIPE_SECRET_KEY is not configured in .env file");
      console.error("Please add your Stripe secret key to continue.");
      process.exit(1);
    }

    let successCount = 0;
    let errorCount = 0;

    // Process each hotel
    for (const hotel of hotelsWithoutStripe) {
      try {
        console.log(`\nProcessing: ${hotel.name} (${hotel._id})`);

        // Create Stripe product and price
        const stripeData = await createStripeProductAndPrice(
          hotel.name,
          hotel.description,
          hotel.price
        );

        // Update hotel with Stripe IDs
        await Hotel.findByIdAndUpdate(hotel._id, {
          stripeProductId: stripeData.productId,
          stripePriceId: stripeData.priceId,
        });

        console.log(`✅ Created Stripe product (${stripeData.productId}) and price (${stripeData.priceId})`);
        successCount++;
      } catch (error) {
        console.error(`❌ Failed to create Stripe product/price for ${hotel.name}:`, error);
        errorCount++;
        // Continue with next hotel even if one fails
      }
    }

    // Summary
    console.log("\n=== MIGRATION SUMMARY ===");
    console.log(`Total hotels processed: ${hotelsWithoutStripe.length}`);
    console.log(`✅ Successfully migrated: ${successCount}`);
    console.log(`❌ Failed: ${errorCount}`);

    if (successCount > 0) {
      console.log("\n✅ Migration completed successfully!");
    }

    process.exit(0);
  } catch (error) {
    console.error("Error during migration:", error);
    process.exit(1);
  }
};

// Run the migration
migrateHotelsToStripe();

