import UnauthorizedError from "../../domain/errors/unauthorized-error";
import { Request, Response, NextFunction } from "express";

const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  // console.log(req.auth()); // If the authorization header is not present or clerk BE tells it is invalid, this will return null
  const authData = req.auth();
  console.log("AUTH_OBJECT", authData);
  console.log("IS_AUTHENTICATED", authData.isAuthenticated);
  if (!authData.isAuthenticated) {
    throw new UnauthorizedError("Unauthorized");
  }
  next();
};

export default isAuthenticated;
