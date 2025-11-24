import Hotel from "../infrastructure/entities/Hotel";
import NotFoundError from "../domain/errors/not-found-error";
import ValidationError from "../domain/errors/validation-error";
import { generateEmbedding } from "./utils/embeddings";
import { createStripeProductAndPrice } from "./utils/stripe-hotel";

import { CreateHotelDTO, SearchHotelDTO } from "../domain/dtos/hotel";

import { Request, Response, NextFunction } from "express";
import { z } from "zod";

export const getAllHotels = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { HotelFilterDTO } = await import("../domain/dtos/hotel-filter");
    
    // Handle array query parameters (locations, amenities)
    const queryParams = { ...req.query };
    if (req.query.locations) {
      queryParams.locations = Array.isArray(req.query.locations)
        ? req.query.locations
        : [req.query.locations];
    }
    if (req.query.amenities) {
      queryParams.amenities = Array.isArray(req.query.amenities)
        ? req.query.amenities
        : [req.query.amenities];
    }
    
    const result = HotelFilterDTO.safeParse(queryParams);
    
    if (!result.success) {
      // If validation fails, return all hotels (backward compatibility)
      const hotels = await Hotel.find().populate("reviews");
      return res.status(200).json({
        hotels,
        total: hotels.length,
        page: 1,
        totalPages: 1,
      });
    }

    const {
      location,
      locations,
      minPrice,
      maxPrice,
      minRating,
      starRating,
      amenities,
      minGuestRating,
      sortBy,
      page,
      limit,
      search,
    } = result.data;

    // If no pagination params provided, return all hotels (backward compatibility)
    const usePagination = page !== undefined || limit !== undefined;
    const pageNum = page || 1;
    const limitNum = limit || (usePagination ? 12 : undefined); // No limit if pagination not requested

    // Build query
    const query: any = {};

    // Location filtering (single or multi-select)
    if (location || (locations && locations.length > 0)) {
      const locationFilters = locations && locations.length > 0 
        ? locations 
        : [location];
      
      query.$or = locationFilters.map((loc) => ({
        location: { $regex: loc, $options: "i" },
      }));
    }

    // Price filtering
    if (minPrice !== undefined || maxPrice !== undefined) {
      query.price = {};
      if (minPrice !== undefined) {
        query.price.$gte = minPrice;
      }
      if (maxPrice !== undefined) {
        query.price.$lte = maxPrice;
      }
    }

    // Rating filtering
    if (minRating !== undefined) {
      query.rating = { $gte: minRating };
    } else if (starRating !== undefined) {
      query.rating = starRating;
    }

    // Amenities filtering
    if (amenities && amenities.length > 0) {
      query.amenities = { $all: amenities };
    }

    // Guest rating (average of reviews)
    // Note: This would require aggregation if we want to filter by review average
    // For now, we'll use the hotel's rating field

    // Search filtering
    if (search) {
      query.$or = [
        ...(query.$or || []),
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { location: { $regex: search, $options: "i" } },
      ];
    }

    // Build sort object
    let sort: any = {};
    switch (sortBy) {
      case "price-asc":
        sort = { price: 1 };
        break;
      case "price-desc":
        sort = { price: -1 };
        break;
      case "rating-desc":
        sort = { rating: -1 };
        break;
      case "name-asc":
        sort = { name: 1 };
        break;
      case "featured":
        // Featured hotels could be sorted by rating or a featured flag
        sort = { rating: -1 };
        break;
      default:
        sort = { createdAt: -1 }; // Default: newest first
    }

    // Calculate pagination
    const skip = usePagination ? (pageNum - 1) * limitNum! : 0;
    const total = await Hotel.countDocuments(query);

    // Execute query
    let queryBuilder = Hotel.find(query).populate("reviews").sort(sort);
    
    if (usePagination && limitNum !== undefined) {
      queryBuilder = queryBuilder.skip(skip).limit(limitNum);
    }
    // If no pagination, return all hotels (no limit)
    
    const hotels = await queryBuilder.lean();

    const totalPages = usePagination && limitNum !== undefined ? Math.ceil(total / limitNum) : 1;

    res.status(200).json({
      hotels,
      total,
      page: usePagination ? pageNum : 1,
      limit: usePagination ? limitNum : total,
      totalPages,
    });
  } catch (error) {
    next(error);
  }
};

export const getAllHotelsBySearchQuery = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = SearchHotelDTO.safeParse(req.query);
    if (!result.success) {
      throw new ValidationError(`${result.error.message}`);
    }
    const { query } = result.data;

    const queryEmbedding = await generateEmbedding(query);

    const hotels = await Hotel.aggregate([
      {
        $vectorSearch: {
          index: "hotel_vector_index",
          path: "embedding",
          queryVector: queryEmbedding,
          numCandidates: 25,
          limit: 4,
        },
      },
      {
        $project: {
          _id: 1,
          name: 1,
          location: 1,
          price: 1,
          image: 1,
          rating: 1,
          reviews: 1,
          score: { $meta: "vectorSearchScore" },
        },
      },
    ]);

    res.status(200).json(hotels);
  } catch (error) {
    next(error);
  }
};

export const createHotel = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const hotelData = req.body;
    const result = CreateHotelDTO.safeParse(hotelData);

    if (!result.success) {
      throw new ValidationError(`${result.error.message}`);
    }

    const embedding = await generateEmbedding(
      `${result.data.name} ${result.data.description} ${result.data.location} ${result.data.price}`
    );

    // Create Stripe product and price for the hotel
    let stripeProductId: string | undefined;
    let stripePriceId: string | undefined;

    try {
      const stripeData = await createStripeProductAndPrice(
        result.data.name,
        result.data.description,
        result.data.price
      );
      stripeProductId = stripeData.productId;
      stripePriceId = stripeData.priceId;
      console.log(`Created Stripe product (${stripeProductId}) and price (${stripePriceId}) for hotel: ${result.data.name}`);
    } catch (stripeError) {
      console.error("Failed to create Stripe product/price:", stripeError);
      // Continue with hotel creation even if Stripe fails
      // This allows hotels to be created without Stripe in development
    }

    await Hotel.create({
      ...result.data,
      embedding,
      stripeProductId,
      stripePriceId,
    });
    res.status(201).send();
  } catch (error) {
    next(error);
  }
};

export const getHotelById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const _id = req.params._id;
    const hotel = await Hotel.findById(_id);
    if (!hotel) {
      throw new NotFoundError("Hotel not found");
    }
    res.status(200).json(hotel);
  } catch (error) {
    next(error);
  }
};

export const updateHotel = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const _id = req.params._id;
    const hotelData = req.body;
    if (
      !hotelData.name ||
      !hotelData.image ||
      !hotelData.location ||
      !hotelData.price ||
      !hotelData.description
    ) {
      throw new ValidationError("Invalid hotel data");
    }

    const hotel = await Hotel.findById(_id);
    if (!hotel) {
      throw new NotFoundError("Hotel not found");
    }

    await Hotel.findByIdAndUpdate(_id, hotelData);
    res.status(200).json(hotelData);
  } catch (error) {
    next(error);
  }
};

export const patchHotel = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const _id = req.params._id;
    const hotelData = req.body;
    if (!hotelData.price) {
      throw new ValidationError("Price is required");
    }
    const hotel = await Hotel.findById(_id);
    if (!hotel) {
      throw new NotFoundError("Hotel not found");
    }
    await Hotel.findByIdAndUpdate(_id, { price: hotelData.price });
    res.status(200).send();
  } catch (error) {
    next(error);
  }
};

export const deleteHotel = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const _id = req.params._id;
    const hotel = await Hotel.findById(_id);
    if (!hotel) {
      throw new NotFoundError("Hotel not found");
    }
    await Hotel.findByIdAndDelete(_id);
    res.status(200).send();
  } catch (error) {
    next(error);
  }
};