import apiService from "../../services/apiService";
import { membershipService } from "../../services/membershipService";

jest.mock("../../services/apiService", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));

const api = apiService as unknown as { get: jest.Mock; post: jest.Mock };

beforeEach(() => {
  api.get.mockReset().mockResolvedValue({ success: true, data: {} });
  api.post.mockReset().mockResolvedValue({ success: true, data: {} });
});

describe("membershipService", () => {
  it("should GET /payment/membership when fetching the membership", async () => {
    await membershipService.get();
    expect(api.get).toHaveBeenCalledWith("/payment/membership");
  });
  it("should POST amount, interval and language when joining", async () => {
    await membershipService.join(12.5, "year", "pt");
    expect(api.post).toHaveBeenCalledWith("/payment/subscribe", { amount: 12.5, interval: "year", language: "pt" });
  });
  it("should POST /payment/cancel when cancelling", async () => {
    await membershipService.cancel();
    expect(api.post).toHaveBeenCalledWith("/payment/cancel");
  });
  it("should POST /payment/resume when resuming", async () => {
    await membershipService.resume();
    expect(api.post).toHaveBeenCalledWith("/payment/resume");
  });
  it("should POST the amount to /payment/amount when changing it", async () => {
    await membershipService.changeAmount(20);
    expect(api.post).toHaveBeenCalledWith("/payment/amount", { amount: 20 });
  });
  it("should POST the language to /payment/update-method when updating the method", async () => {
    await membershipService.updateMethod("en");
    expect(api.post).toHaveBeenCalledWith("/payment/update-method", { language: "en" });
  });
  it("should GET the encoded checkout id when polling checkout status", async () => {
    await membershipService.checkoutStatus("a/b c");
    expect(api.get).toHaveBeenCalledWith("/payment/checkout-status/a%2Fb%20c");
  });
});
