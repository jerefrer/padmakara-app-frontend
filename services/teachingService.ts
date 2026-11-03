import apiService from "./apiService";
import { API_ENDPOINTS, ApiResponse } from "./apiConfig";
import type { CheckoutManifest } from "./membershipService";

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
