import { validateAmount, formatEuro, MIN_AMOUNT, MAX_AMOUNT, SUGGESTED } from "../../utils/membership";

describe("validateAmount", () => {
  it("should accept the monthly minimum when amount is 5", () => {
    expect(validateAmount(5, "month")).toEqual({ ok: true, amount: 5 });
  });
  it("should reject with min when monthly amount is 4.99", () => {
    expect(validateAmount(4.99, "month")).toEqual({ ok: false, reason: "min" });
  });
  it("should accept the yearly minimum when amount is 60", () => {
    expect(validateAmount(60, "year")).toEqual({ ok: true, amount: 60 });
  });
  it("should reject with min when yearly amount is 59", () => {
    expect(validateAmount(59, "year")).toEqual({ ok: false, reason: "min" });
  });
  it("should accept the maximum when amount is 1000", () => {
    expect(validateAmount(1000, "month")).toEqual({ ok: true, amount: 1000 });
  });
  it("should reject with max when amount is 1000.01", () => {
    expect(validateAmount(1000.01, "month")).toEqual({ ok: false, reason: "max" });
  });
  it("should accept a comma decimal when input is 12,50", () => {
    expect(validateAmount("12,50", "month")).toEqual({ ok: true, amount: 12.5 });
  });
  it.each([19.99, 5.1, 16.35, "19.99"])("should accept %s despite float representation", (v) => {
    expect(validateAmount(v, "month").ok).toBe(true);
  });
  it.each(["12.555", "5.555", 12.555])("should reject with decimals when input is %s", (v) => {
    expect(validateAmount(v, "month")).toEqual({ ok: false, reason: "decimals" });
  });
  it.each(["abc", "", "  ", NaN, Infinity])("should reject with nan when input is %p", (v) => {
    expect(validateAmount(v, "month")).toEqual({ ok: false, reason: "nan" });
  });
  it("should expose the limits and suggestions", () => {
    expect(MIN_AMOUNT).toEqual({ month: 5, year: 60 });
    expect(MAX_AMOUNT).toBe(1000);
    expect(SUGGESTED.year).toEqual([60, 120, 240]);
  });
});

describe("formatEuro with two decimals", () => {
  it("should keep two decimals for whole euros when asked, in english", () => {
    expect(formatEuro(10, "en", { decimals: true })).toBe("€10.00");
  });
  it("should keep two decimals for whole euros when asked, in portuguese", () => {
    expect(formatEuro(10, "pt", { decimals: true })).toBe("10,00 €");
  });
});

describe("formatEuro", () => {
  it("should format whole euros without decimals when english", () => {
    expect(formatEuro(10, "en")).toBe("€10");
  });
  it("should format two decimals when english and fractional", () => {
    expect(formatEuro(12.5, "en")).toBe("€12.50");
  });
  it("should put the symbol after with a space when portuguese", () => {
    expect(formatEuro(10, "pt")).toBe("10 €");
  });
  it("should use a decimal comma when portuguese and fractional", () => {
    expect(formatEuro(12.5, "pt")).toBe("12,50 €");
  });
});
