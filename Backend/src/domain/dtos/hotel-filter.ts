import { z } from "zod";

export const HotelFilterDTO = z.object({
  // Location filtering
  location: z.string().optional(),
  locations: z.array(z.string()).optional(), // Multi-select locations
  
  // Price filtering
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  
  // Rating filtering
  minRating: z.coerce.number().min(1).max(5).optional(),
  starRating: z.coerce.number().min(1).max(5).optional(),
  
  // Amenities filtering
  amenities: z.array(z.string()).optional(),
  
  // Guest rating
  minGuestRating: z.coerce.number().min(1).max(5).optional(),
  
  // Sorting
  sortBy: z.enum([
    "price-asc",
    "price-desc",
    "rating-desc",
    "name-asc",
    "featured"
  ]).optional(),
  
  // Pagination (optional - if not provided, returns all hotels)
  page: z.coerce.number().min(1).optional(),
  limit: z.coerce.number().min(1).max(100).optional(),
  
  // Search
  search: z.string().optional(),
});

export type HotelFilterParams = z.infer<typeof HotelFilterDTO>;

