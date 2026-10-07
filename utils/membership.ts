// Mirrors the API's membership amount rules (D2).
export type MembershipInterval = "month" | "year";

export const MIN_AMOUNT: Record<MembershipInterval, number> = { month: 5, year: 60 };
export const MAX_AMOUNT = 1000;
export const SUGGESTED: Record<MembershipInterval, number[]> = {
  month: [5, 10, 20],
  year: [60, 120, 240],
};

export type AmountValidation =
  | { ok: true; amount: number }
  | { ok: false; reason: "nan" | "min" | "max" | "decimals" };

export function validateAmount(raw: string | number, interval: MembershipInterval): AmountValidation {
  if (typeof raw === "string" && raw.trim() === "") return { ok: false, reason: "nan" };
  const value = typeof raw === "number" ? raw : Number(raw.trim().replace(",", "."));
  if (!Number.isFinite(value)) return { ok: false, reason: "nan" };
  // Tolerance-based: exact float equality rejects valid cents such as 19.99 or 16.35.
  if (Math.abs(value * 100 - Math.round(value * 100)) > 1e-6) return { ok: false, reason: "decimals" };
  if (value < MIN_AMOUNT[interval]) return { ok: false, reason: "min" };
  if (value > MAX_AMOUNT) return { ok: false, reason: "max" };
  return { ok: true, amount: value };
}

export function formatEuro(amount: number, language: "en" | "pt"): string {
  const whole = Math.abs(amount - Math.round(amount)) < 1e-9;
  const text = whole ? String(Math.round(amount)) : amount.toFixed(2);
  return language === "pt" ? `${text.replace(".", ",")} €` : `€${text}`;
}
