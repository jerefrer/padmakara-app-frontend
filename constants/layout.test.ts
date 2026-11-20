import { Platform } from "react-native";
import { hairlineThickness, ruleThickness } from "@/constants/layout";

describe("line thickness", () => {
  const originalOS = Platform.OS;
  const originalRatio = (global as any).window?.devicePixelRatio;

  afterEach(() => {
    (Platform as any).OS = originalOS;
    if ((global as any).window) (global as any).window.devicePixelRatio = originalRatio;
  });

  it.each([1, 1.25, 2, 3])(
    "should draw one device pixel on the web when the pixel ratio is %s",
    (ratio) => {
      (Platform as any).OS = "web";
      (global as any).window = (global as any).window ?? {};
      (global as any).window.devicePixelRatio = ratio;
      // A box of exactly one device pixel is never collapsed by the browser's pixel snapping.
      expect(hairlineThickness() * ratio).toBeCloseTo(1, 10);
      expect(ruleThickness() * ratio).toBeCloseTo(1, 10);
    },
  );

  it("should draw a full point for the rule and a hairline for subdivisions on a phone", () => {
    (Platform as any).OS = "ios";
    expect(ruleThickness()).toBe(1);
    expect(hairlineThickness()).toBeLessThan(1);
  });
});
