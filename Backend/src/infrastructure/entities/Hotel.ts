import mongoose from "mongoose";

const hotelSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  location: {
    type: String,
    required: true,
  },
  image: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  price: {
    type: Number,
    required: true,
  },
  rating: {
    type: Number,
    min: 1,
    max: 5,
  },
  reviews: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: "Review",
    default: [],
  },
  amenities: {
    type: [String],
    default: [],
  },
  embedding: {
    type: [Number],
    default: [],
  },
  stripeProductId: {
    type: String,
    required: false,
  },
  stripePriceId: {
    type: String,
    required: false,
  },
});

const Hotel = mongoose.model("Hotel", hotelSchema);

export default Hotel;