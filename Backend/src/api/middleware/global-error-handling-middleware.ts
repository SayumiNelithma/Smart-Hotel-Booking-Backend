import NotFoundError from "../../domain/errors/not-found-error";
import ValidationError from "../../domain/errors/validation-error";
import UnauthorizedError from "../../domain/errors/unauthorized-error";
import ForbiddenError from "../../domain/errors/forbidden-error";

import { Request, Response, NextFunction } from "express";

const globalErrorHandlingMiddleware = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Always log error in terminal
  console.error("Global Error:", {
    message: error.message,
    stack: error.stack,
    details: error, // full object (useful for OpenAI errors)
  });

  if (error instanceof NotFoundError) {
    return res.status(error.statusCode).json({ message: error.message });
  }

  if (error instanceof ValidationError) {
    return res.status(error.statusCode).json({ message: error.message });
  }

  if (error instanceof UnauthorizedError) {
    return res.status(error.statusCode).json({ message: error.message });
  }

  if (error instanceof ForbiddenError) {
    return res.status(error.statusCode).json({ message: error.message });
  }

  // For other/unexpected errors
  return res.status(500).json({
    message: error.message || "Internal Server Error",
    // only show stack/details in dev mode
    ...(process.env.NODE_ENV === "development" && {
      stack: error.stack,
      details: error,
    }),
  });
};

export default globalErrorHandlingMiddleware;
