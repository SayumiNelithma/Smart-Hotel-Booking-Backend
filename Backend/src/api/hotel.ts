import express from "express";
import { Request, Response, NextFunction } from "express";

import {
  getAllHotels,
  createHotel,
  getHotelById,
  updateHotel,
  patchHotel,
  deleteHotel,
} from "../application/hotel";
import isAuthenticated from "./middleware/authentication-middleware";
import isAdmin from "./middleware/authorization-middleware";
import { respondToAIQuery } from "../application/ai";

const hotelsRouter = express.Router();

const preMiddleware = (req: Request, res: Response, next: NextFunction) => {
  console.log(req.method, req.url);
  next();
};

hotelsRouter
  .route("/")
  .get(getAllHotels) // Now supports query parameters for filtering
  .post(isAuthenticated, isAdmin, createHotel);

hotelsRouter.route("/ai").post(respondToAIQuery);
hotelsRouter
  .route("/:_id")
  .get(isAuthenticated, getHotelById)
  .put(updateHotel)
  .patch(patchHotel)
  .delete(deleteHotel);

export default hotelsRouter;
