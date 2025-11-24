import { Request, Response, NextFunction } from "express";
import Review from "../infrastructure/entities/Review";
import Hotel from "../infrastructure/entities/Hotel";
import NotFoundError from "../domain/errors/not-found-error";
import ValidationError from "../domain/errors/validation-error";
import { getAuth } from "@clerk/express";

const createReview = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const reviewData = req.body;
    if (!reviewData.rating || !reviewData.comment || !reviewData.hotelId || !reviewData.userName) {
      throw new ValidationError("Rating, comment, hotelId and userName are required");
    }

    const { userId } = getAuth(req);

    const hotel = await Hotel.findById(reviewData.hotelId);
    if (!hotel) {
      throw new NotFoundError("Hotel not found");
    }

    const review = await Review.create({
      rating: reviewData.rating,
      comment: reviewData.comment,
      userId: userId,
      userName: reviewData.userName,
    });

    hotel.reviews.push(review._id);
    await hotel.save();
    res.status(201).json(review);
  } catch (error) {
    next(error);
  }
};

const getReviewsForHotel = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const hotelId = req.params.hotelId;
    const hotel = await Hotel.findById(hotelId).populate("reviews");
    if (!hotel) {
      throw new NotFoundError("Hotel not found");
    }

    res.status(200).json(hotel.reviews);
  } catch (error) {
    next(error);
  }
};

export { createReview, getReviewsForHotel };
