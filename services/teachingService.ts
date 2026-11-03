import apiService from "./apiService";
import { API_ENDPOINTS, ApiResponse } from "./apiConfig";
import type { CheckoutManifest } from "./membershipService";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { CACHE_KEY_PREFIX } from "./cacheSchemaVersion";
import { mapEvent } from "./retreatService";
import type { Gathering } from "@/types";

// Under the shared cache prefix, so a schema bump or sign-out wipe removes it too.
const MINE_CACHE_KEY = `${CACHE_KEY_PREFIX}teachings:mine`;

/** What the public sale page shows (GET /teachings/:eventId). */
export interface Teaching {
  id: number;
  titleEn: string | null;
  titlePt: string | null;
  startDate: string | null;
  endDate: string | null;
  imageUrl: string | null;
  teachers: { name: string }[];
  places: { name: string }[];
  sessionCount: number;
  published: boolean;
  saleMode: "free" | "paid";
  priceCents: number | null;
  includedInMembership: boolean;
}

export interface TeachingCheckoutInput {
  email: string;
  firstName: string;
  lastName: string;
  language: "en" | "pt";
  consent: true;
}

export type TeachingCheckoutResult =
  | { status: "granted" }
  | { status: "checkout"; orderId: string; checkout: CheckoutManifest; testing: boolean };

export type TeachingOrderStatus = "pending" | "paid" | "failed" | "expired" | "cancelled";

export interface TeachingOrder {
  status: TeachingOrderStatus;
  eventId: number;
  method: string | null;
  amountCents: number;
  mbReference?: { entity: string; reference: string; amount: number };
}

export const teachingService = {
  /**
   * Teachings the signed-in user has access to (GET /teachings/mine). The last good
   * list is kept so the section still shows offline; with nothing cached a failure
   * is an empty list, never a throw.
   */
  async mine(): Promise<{ success: boolean; data: Gathering[]; error?: string }> {
    const res = await apiService.get<any[]>(API_ENDPOINTS.TEACHINGS_MINE);
    if (res.success && Array.isArray(res.data)) {
      try {
        await AsyncStorage.setItem(MINE_CACHE_KEY, JSON.stringify(res.data));
      } catch {
        // Cache is best effort.
      }
      return { success: true, data: res.data.map(mapEvent) };
    }
    try {
      const raw = await AsyncStorage.getItem(MINE_CACHE_KEY);
      const cached = raw ? JSON.parse(raw) : null;
      if (Array.isArray(cached)) return { success: true, data: cached.map(mapEvent) };
    } catch {
      // Unreadable cache counts as a miss.
    }
    return { success: false, data: [], error: res.error };
  },
  get(eventId: string): Promise<ApiResponse<Teaching>> {
    return apiService.get<Teaching>(API_ENDPOINTS.TEACHING(eventId));
  },
  checkout(eventId: string, input: TeachingCheckoutInput): Promise<ApiResponse<TeachingCheckoutResult>> {
    return apiService.post<TeachingCheckoutResult>(API_ENDPOINTS.TEACHING_CHECKOUT(eventId), input);
  },
  order(publicId: string): Promise<ApiResponse<TeachingOrder>> {
    return apiService.get<TeachingOrder>(API_ENDPOINTS.TEACHING_ORDER(publicId));
  },
};
