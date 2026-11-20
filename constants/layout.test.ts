import { Platform } from "react-native";
import {
  DESKTOP_LINE_RIGHT_GAP,
  desktopLineBleed,
  desktopRowBleed,
  hairlineThickness,
  ruleThickness,
} from "@/constants/layout";

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

describe("desktop line geometry", () => {
  it("should reach back to the column edge and stop at the sidebar's right gap when a line is bled", () => {
    expect(desktopLineBleed(24)).toEqual({ marginLeft: -24, marginRight: DESKTOP_LINE_RIGHT_GAP - 24 });
    expect(desktopLineBleed(0)).toEqual({ marginLeft: 0, marginRight: DESKTOP_LINE_RIGHT_GAP });
  });

  it("should keep the content where it was when a row is bled", () => {
    expect(desktopRowBleed(24)).toEqual({
      marginLeft: -24,
      paddingLeft: 24,
      marginRight: -4,
      paddingRight: 4,
    });
  });

  it("should never ask for a negative padding when the column is padded less than the gap", () => {
    expect(desktopRowBleed(16).paddingRight).toBe(0);
  });
});
