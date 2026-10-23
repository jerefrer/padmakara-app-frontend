import { pickResumePosition, resolveVideoDeepLink } from "../../utils/videoDeepLink";

const videos = [{ id: 4 }, { id: 5 }] as { id: number }[];

describe("resolveVideoDeepLink", () => {
  it("should return the matching video and position", () => {
    expect(resolveVideoDeepLink(videos, { videoId: "5", position: "754" })).toEqual({
      video: videos[1],
      position: 754,
    });
  });

  it("should return null when no videoId param is given", () => {
    expect(resolveVideoDeepLink(videos, {})).toBeNull();
  });

  it("should return null when the video is not in the list", () => {
    expect(resolveVideoDeepLink(videos, { videoId: "99" })).toBeNull();
  });

  it("should return null when the list is missing", () => {
    expect(resolveVideoDeepLink(undefined, { videoId: "5" })).toBeNull();
  });

  it("should start at zero when the position is missing or invalid", () => {
    expect(resolveVideoDeepLink(videos, { videoId: "5" })?.position).toBe(0);
    expect(resolveVideoDeepLink(videos, { videoId: "5", position: "abc" })?.position).toBe(0);
    expect(resolveVideoDeepLink(videos, { videoId: "5", position: "-4" })?.position).toBe(0);
  });
});

describe("pickResumePosition", () => {
  it("should keep the computed resume position when there is no initial position", () => {
    expect(pickResumePosition(undefined, 120, 3600)).toBe(120);
  });

  it("should override the saved position with the initial one", () => {
    expect(pickResumePosition(754, 120, 3600)).toBe(754);
  });

  it("should allow an initial position of zero to override a saved one", () => {
    expect(pickResumePosition(0, 120, 3600)).toBe(0);
  });

  it("should ignore an initial position past the end of the video", () => {
    expect(pickResumePosition(4000, 120, 3600)).toBe(120);
  });

  it("should trust the initial position when the duration is unknown", () => {
    expect(pickResumePosition(754, 0, 0)).toBe(754);
  });
});
