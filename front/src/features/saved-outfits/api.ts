import type {
  CreateSavedOutfitRequest,
  DeleteSavedOutfitResponse,
  SavedOutfitListResponse,
  SavedOutfitResponse,
} from "@/features/saved-outfits/types";
import { apiRequest } from "@/lib/api/client";

export function listSavedOutfits(options?: {
  signal?: AbortSignal;
}): Promise<SavedOutfitListResponse> {
  return apiRequest<SavedOutfitListResponse>("/saved-outfits", {
    auth: true,
    method: "GET",
    signal: options?.signal,
  });
}

export function createSavedOutfit(
  request: CreateSavedOutfitRequest,
): Promise<SavedOutfitResponse> {
  return apiRequest<SavedOutfitResponse>("/saved-outfits", {
    auth: true,
    body: request,
    method: "POST",
  });
}

export function getSavedOutfit(id: string): Promise<SavedOutfitResponse> {
  return apiRequest<SavedOutfitResponse>(
    `/saved-outfits/${encodeURIComponent(id)}`,
    {
      auth: true,
      method: "GET",
    },
  );
}

export function deleteSavedOutfit(
  id: string,
): Promise<DeleteSavedOutfitResponse> {
  return apiRequest<DeleteSavedOutfitResponse>(
    `/saved-outfits/${encodeURIComponent(id)}`,
    {
      auth: true,
      method: "DELETE",
    },
  );
}
