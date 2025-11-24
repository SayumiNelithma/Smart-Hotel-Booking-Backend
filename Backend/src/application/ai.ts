import { Request, Response, NextFunction } from "express";

import { OpenAI } from "openai";
import Hotel from "../infrastructure/entities/Hotel";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const messages: { role: "user" | "assistant"; content: string }[] = [];

/**
 * POST /api/hotels/ai
 * Expects body: { query: string, preferences?: object, filters?: object }
 * Returns structured response: { response: string, recommendations: HotelSummary[], filteredHotels: HotelSummary[] }
 */
export const respondToAIQuery = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
  const { query, preferences = {}, filters = {}, page = 1, pageSize = 10 } = req.body || {};
    if (!query || typeof query !== "string") {
      return res.status(400).json({ message: "Missing `query` string in request body" });
    }

    messages.push({ role: "user", content: query });

    // Load hotels and apply lightweight server-side filters to reduce prompt size
    let hotelsData = await Hotel.find().lean();

    // Apply common filters if provided (price range, location, amenities)
    if (filters) {
      hotelsData = hotelsData.filter((h: any) => {
        if (filters.maxPrice && Number(h.price) > Number(filters.maxPrice)) return false;
        if (filters.minPrice && Number(h.price) < Number(filters.minPrice)) return false;
        if (filters.location && filters.location !== "" && String(h.location).toLowerCase().indexOf(String(filters.location).toLowerCase()) === -1) return false;
        if (filters.amenities && Array.isArray(filters.amenities) && filters.amenities.length > 0) {
          const hasAll = filters.amenities.every((a: string) => (h.amenities || []).includes(a));
          if (!hasAll) return false;
        }
        return true;
      });
    }

    // Prepare a compact summary for the LLM to avoid sending huge objects
    const hotelSummaries = hotelsData.map((h: any) => ({
      _id: h._id,
      name: h.name,
      location: h.location,
      image: h.image,
      price: h.price,
      rating: h.rating,
      shortDescription: h.description?.substring(0, 200),
      amenities: h.amenities || [],
    }));

    // Build helpful instructions for the model including user preferences
    const instruction = `You are a helpful travel assistant. A user described their desired "vibe" or preferences. Given the available hotels (summaries) below, recommend up to 5 hotels that best match the user's request and preferences.

User preferences: ${JSON.stringify(preferences)}
User query: ${query}

Hotels (summary): ${JSON.stringify(hotelSummaries)}

Requirements: Return a short explanation for the recommendation and a JSON list named 'recommendations' containing objects with keys: _id, name, reason. Do not include other fields.`;

    // Ensure API key is present; if missing, gracefully fall back with heuristic recommendations
    if (!process.env.OPENAI_API_KEY) {
      console.warn("OpenAI API key is not set - returning heuristic recommendations");
      const fallbackText = "AI is temporarily unavailable. Showing top matches based on your filters and ratings.";
      const recommendations = hotelSummaries
        .slice()
        .sort((a: any, b: any) => (Number(b.rating || 0) - Number(a.rating || 0)))
        .slice(0, 5)
        .map((h: any) => ({ _id: h._id, name: h.name, reason: "Top-rated match based on current filters" }));
      // Resolve matched hotels from recommendations ids if possible
      const matchedHotels = recommendations
        .map((r: any) => hotelSummaries.find((h: any) => String(h._id) === String(r._id)))
        .filter(Boolean)
        .slice(0, 12);
      return res.status(200).json({ response: fallbackText, recommendations, matchedHotels, filteredHotels: hotelSummaries.slice(0, 50) });
    }

    let response: any;
    try {
      // Ask the model to return a JSON fenced block to make parsing reliable
      const fullInstructions = instruction + "\n\nIMPORTANT: After the explanation, include a JSON fenced block (```json ...) that contains a single top-level object with a 'recommendations' array. Example:\n```json\n{ \"recommendations\": [{ \"_id\": \"...\", \"name\": \"...\", \"reason\": \"...\" }] }\n```\nDo not include any other code fences or extraneous JSON blocks.";

      response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: fullInstructions
          },
          {
            role: "user", 
            content: query
          }
        ],
        max_tokens: 800,
      });
    } catch (err: any) {
      console.error("OpenAI request failed:", err);
      // Graceful fallback: return heuristic recommendations instead of failing the request
      const fallbackText = "AI request failed. Showing top matches based on your filters and ratings.";
      const recommendations = hotelSummaries
        .slice()
        .sort((a: any, b: any) => (Number(b.rating || 0) - Number(a.rating || 0)))
        .slice(0, 5)
        .map((h: any) => ({ _id: h._id, name: h.name, reason: "Top-rated match based on current filters" }));
      const matchedHotels = recommendations
        .map((r: any) => hotelSummaries.find((h: any) => String(h._id) === String(r._id)))
        .filter(Boolean)
        .slice(0, 12);
      return res.status(200).json({ response: fallbackText, recommendations, matchedHotels, filteredHotels: hotelSummaries.slice(0, 50) });
    }

    const aiResponse = response.choices[0]?.message?.content || "";

    messages.push({ role: "assistant", content: aiResponse });

    // Attempt to extract recommendations JSON from the assistant's text (prefer fenced JSON)
    let recommendations: any[] = [];
    try {
      // First try to find a fenced ```json block
      const fencedJsonMatch = aiResponse.match(/```json([\s\S]*?)```/i);
      const candidate = fencedJsonMatch ? fencedJsonMatch[1] : (aiResponse.match(/\{[\s\S]*\}|\[[\s\S]*\]/) || [null])[0];
      if (candidate) {
        const parsed = JSON.parse(candidate);
        if (Array.isArray(parsed)) recommendations = parsed;
        else if (parsed && Array.isArray(parsed.recommendations)) recommendations = parsed.recommendations;
      }
    } catch (err) {
      console.warn("Failed to parse AI JSON block:", err);
      // We'll fallback to heuristic matching below
    }

    // If we couldn't parse recommendations, try to match hotel names heuristically
    if (recommendations.length === 0 && hotelSummaries.length > 0) {
      const lowerText = aiResponse.toLowerCase();
      recommendations = hotelSummaries
        .filter((h: any) => lowerText.includes(String(h.name).toLowerCase()))
        .slice(0, 5)
        .map((h: any) => ({ _id: h._id, name: h.name, reason: "Matched in assistant response" }));
    }

    // Resolve matched hotels from recommendations ids; if empty, fall back to top ratings
    let matchedHotels = recommendations
      .map((r: any) => hotelSummaries.find((h: any) => String(h._id) === String(r._id)))
      .filter(Boolean)
      .slice(0, 12);
    if (matchedHotels.length === 0) {
      matchedHotels = hotelSummaries
        .slice()
        .sort((a: any, b: any) => (Number(b.rating || 0) - Number(a.rating || 0)))
        .slice(0, 12);
    }

    // Pagination of results
    const totalCount = hotelSummaries.length;
    const p = Math.max(1, Number(page) || 1);
    const ps = Math.max(1, Math.min(100, Number(pageSize) || 10));
    const start = (p - 1) * ps;
    const results = hotelSummaries.slice(start, start + ps);

    res.status(200).json({ response: aiResponse, recommendations, matchedHotels, results, totalCount });
  } catch (error) {
    next(error);
  }
};

