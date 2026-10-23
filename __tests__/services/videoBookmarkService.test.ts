import videoBookmarkService from "../../services/videoBookmarkService";
import apiService from "../../services/apiService";

jest.mock("../../services/apiService", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

const mocked = apiService as unknown as {
  get: jest.Mock;
  post: jest.Mock;
  patch: jest.Mock;
  delete: jest.Mock;
};

const rawBookmark = {
  id: 3,
  videoId: 5,
  positionSeconds: 754,
  note: "Key passage",
  createdAt: "2026-05-01T12:00:00.000Z",
  video: {
    id: 5,
    eventId: 42,
    position: 0,
    titleEn: "Part 1",
    titlePt: null,
    videoDate: "2024-04-15",
    event: {
      id: 42,
      titleEn: "Spring Retreat",
      titlePt: "Retiro de Primavera",
      startDate: "2024-04-15",
      endDate: "2024-04-20",
      eventTeachers: [
        { teacher: { name: "Teacher A", abbreviation: "TA", avatarUrl: "https://x/a.jpg" } },
        { teacher: null },
      ],
    },
  },
};

describe("videoBookmarkService", () => {
  beforeEach(() => jest.clearAllMocks());

  it("should map the API rows to bookmarks with the event and teachers when listing", async () => {
    mocked.get.mockResolvedValue({ success: true, data: [rawBookmark] });

    const res = await videoBookmarkService.list();

    expect(mocked.get).toHaveBeenCalledWith("/content/video-bookmarks");
    expect(res.success).toBe(true);
    const bm = res.data![0];
    expect(bm).toMatchObject({
      id: 3,
      videoId: 5,
      positionSeconds: 754,
      note: "Key passage",
      createdAt: "2026-05-01T12:00:00.000Z",
    });
    expect(bm.video.event.titlePt).toBe("Retiro de Primavera");
    expect(bm.video.event.teachers).toEqual([
      { name: "Teacher A", abbreviation: "TA", avatarUrl: "https://x/a.jpg", photoUrl: null },
    ]);
  });

  it("should report authRequired when the list is refused", async () => {
    mocked.get.mockResolvedValue({ success: false, error: "no", authRequired: true });

    const res = await videoBookmarkService.list();

    expect(res).toEqual({ success: false, error: "no", authRequired: true });
  });

  it("should post the position, note and createdAt when adding", async () => {
    mocked.post.mockResolvedValue({ success: true, data: rawBookmark });

    const res = await videoBookmarkService.add({
      videoId: 5,
      positionSeconds: 754,
      note: "Key passage",
      createdAt: "2026-05-01T12:00:00.000Z",
    });

    expect(mocked.post).toHaveBeenCalledWith("/content/video-bookmarks", {
      videoId: 5,
      positionSeconds: 754,
      note: "Key passage",
      createdAt: "2026-05-01T12:00:00.000Z",
    });
    expect(res.success).toBe(true);
    expect(res.data!.id).toBe(3);
  });

  it("should omit an empty note when adding", async () => {
    mocked.post.mockResolvedValue({ success: true, data: rawBookmark });

    await videoBookmarkService.add({ videoId: 5, positionSeconds: 10, note: "" });

    expect(mocked.post).toHaveBeenCalledWith("/content/video-bookmarks", {
      videoId: 5,
      positionSeconds: 10,
    });
  });

  it("should return the error when adding fails", async () => {
    mocked.post.mockResolvedValue({ success: false, error: "boom" });

    const res = await videoBookmarkService.add({ videoId: 5, positionSeconds: 10 });

    expect(res).toEqual({ success: false, error: "boom" });
  });

  it("should delete by bookmark id when removing", async () => {
    mocked.delete.mockResolvedValue({ success: true });

    const res = await videoBookmarkService.remove(3);

    expect(mocked.delete).toHaveBeenCalledWith("/content/video-bookmarks/3");
    expect(res.success).toBe(true);
  });

  it("should patch the note when updating", async () => {
    mocked.patch.mockResolvedValue({ success: true, data: { id: 3, note: "n" } });

    const res = await videoBookmarkService.updateNote(3, "n");

    expect(mocked.patch).toHaveBeenCalledWith("/content/video-bookmarks/3", { note: "n" });
    expect(res.success).toBe(true);
  });
});
