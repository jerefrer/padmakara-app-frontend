import apiService from "./apiService";
import { API_ENDPOINTS, ApiResponse } from "./apiConfig";
import type { MembershipInterval } from "../utils/membership";

export type MembershipState = "none" | "active" | "cancelled" | "payment_failed" | "lapsed" | "processing";
export type MembershipSource = "easypay" | "admin" | "cash" | "bank_transfer" | null;
export type PaymentMethodType = "card" | "direct_debit";

export interface MembershipView {
  state: MembershipState;
  source: MembershipSource;
  amount: number | null;
  interval: MembershipInterval | null;
  accessUntil: string | null;
  graceUntil: string | null;
  cancelledAt: string | null;
  method: { type: PaymentMethodType; lastFour: string | null; brand: string | null } | null;
  history: { date: string; amount: number | null; outcome: "paid" | "failed" | "refunded" }[];
  lastPaymentFailedAt: string | null;
}

/** What /payment/subscribe and /payment/update-method return so the app can embed Easypay's form. */
export interface CheckoutManifest {
  id: string;
  session: string;
}
export interface CheckoutStart {
  /** Hosted-page fallback. The app embeds the form from `checkout` instead. */
  url: string;
  checkout: CheckoutManifest;
  testing: boolean;
}

export type CheckoutState = "active" | "processing" | "failed" | "pending";

export const membershipService = {
  get(): Promise<ApiResponse<MembershipView>> {
    return apiService.get<MembershipView>(API_ENDPOINTS.MEMBERSHIP);
  },
  join(amount: number, interval: MembershipInterval, language: "en" | "pt"): Promise<ApiResponse<CheckoutStart>> {
    return apiService.post<CheckoutStart>(API_ENDPOINTS.MEMBERSHIP_JOIN, { amount, interval, language });
  },
  cancel(): Promise<ApiResponse<{ url: string; accessUntil: string | null }>> {
    return apiService.post<{ url: string; accessUntil: string | null }>(API_ENDPOINTS.MEMBERSHIP_CANCEL);
  },
  resume(): Promise<ApiResponse<{ accessUntil: string }>> {
    return apiService.post<{ accessUntil: string }>(API_ENDPOINTS.MEMBERSHIP_RESUME);
  },
  changeAmount(amount: number): Promise<ApiResponse<{ amount: number }>> {
    return apiService.post<{ amount: number }>(API_ENDPOINTS.MEMBERSHIP_AMOUNT, { amount });
  },
  updateMethod(language: "en" | "pt"): Promise<ApiResponse<CheckoutStart>> {
    return apiService.post<CheckoutStart>(API_ENDPOINTS.MEMBERSHIP_UPDATE_METHOD, { language });
  },
  checkoutStatus(
    checkoutId: string,
  ): Promise<ApiResponse<{ state: CheckoutState; method: PaymentMethodType | null }>> {
    return apiService.get<{ state: CheckoutState; method: PaymentMethodType | null }>(
      API_ENDPOINTS.MEMBERSHIP_CHECKOUT_STATUS(checkoutId),
    );
  },
};
