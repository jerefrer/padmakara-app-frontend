import { formatVideoPosition } from "../../utils/formatVideoPosition";

describe("formatVideoPosition", () => {
  it("should show minutes and zero-padded seconds when under an hour", () => {
    expect(formatVideoPosition(754)).toBe("12:34");
  });

  it("should show 0:00 at the start", () => {
    expect(formatVideoPosition(0)).toBe("0:00");
  });

  it("should add hours with zero-padded minutes from one hour on", () => {
    expect(formatVideoPosition(3725)).toBe("1:02:05");
  });

  it("should round down fractions and clamp negatives to zero", () => {
    expect(formatVideoPosition(59.9)).toBe("0:59");
    expect(formatVideoPosition(-5)).toBe("0:00");
  });
});
