/**
 * Payment error handling utilities
 */

export class PaymentError extends Error {
  constructor(
    message: string,
    public code?: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = "PaymentError";
  }
}

export const handleStripeError = (error: any): PaymentError => {
  if (error.type === "StripeCardError") {
    return new PaymentError(
      error.message || "Your card was declined.",
      error.code,
      402
    );
  } else if (error.type === "StripeRateLimitError") {
    return new PaymentError(
      "Too many requests made to the API too quickly.",
      "rate_limit_error",
      429
    );
  } else if (error.type === "StripeInvalidRequestError") {
    return new PaymentError(
      error.message || "Invalid parameters were supplied to Stripe's API.",
      "invalid_request_error",
      400
    );
  } else if (error.type === "StripeAPIError") {
    return new PaymentError(
      "An error occurred internally with Stripe's API.",
      "api_error",
      500
    );
  } else if (error.type === "StripeConnectionError") {
    return new PaymentError(
      "Some kind of error occurred during the HTTPS communication.",
      "connection_error",
      500
    );
  } else if (error.type === "StripeAuthenticationError") {
    return new PaymentError(
      "You probably used an incorrect API key.",
      "authentication_error",
      401
    );
  } else {
    return new PaymentError(
      error.message || "An unexpected error occurred.",
      "unknown_error",
      500
    );
  }
};

