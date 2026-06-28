import type {
  ProductRecommendationRequest,
  ProductRecommendationResponse,
} from "@/features/ai/recommendationTypes";
import { apiRequest } from "@/lib/api/client";

export function recommendProducts(
  request: ProductRecommendationRequest,
): Promise<ProductRecommendationResponse> {
  return apiRequest<ProductRecommendationResponse>("/ai/recommend-products", {
    auth: true,
    body: request,
    method: "POST",
  });
}
