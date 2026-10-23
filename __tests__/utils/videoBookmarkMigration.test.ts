import {
  migrateLocalVideoBookmarks,
  parseLocalVideoBookmarks,
} from "../../utils/videoBookmarkMigration";

const local = [
  { id: "bookmark_1", trackId: "video-5", position: 30, note: "a", createdAt: "2026-01-01T00:00:00.000Z" },
  { id: "bookmark_2", trackId: "video-5", position: 90, note: "", createdAt: "2026-01-02T00:00:00.000Z" },
];

describe("parseLocalVideoBookmarks", () => {
  it("should return an empty list when nothing is stored", () => {
    expect(parseLocalVideoBookmarks(null, 5)).toEqual([]);
  });

  it("should return an empty list when the stored value is not valid JSON", () => {
    expect(parseLocalVideoBookmarks("{oops", 5)).toEqual([]);
  });

  it("should map stored bookmarks to API payloads keeping position, note and date", () => {
    expect(parseLocalVideoBookmarks(JSON.stringify(local), 5)).toEqual([
      { videoId: 5, positionSeconds: 30, note: "a", createdAt: "2026-01-01T00:00:00.000Z" },
      { videoId: 5, positionSeconds: 90, note: undefined, createdAt: "2026-01-02T00:00:00.000Z" },
    ]);
  });

  it("should skip entries without a valid position", () => {
    const raw = JSON.stringify([{ id: "x", position: "abc" }, { id: "y", position: -3 }, local[0]]);
    expect(parseLocalVideoBookmarks(raw, 5)).toHaveLength(1);
  });
});

describe("migrateLocalVideoBookmarks", () => {
  const key = "bookmarks_video-5";

  function makeStorage(value: string | null) {
    return {
      getItem: jest.fn().mockResolvedValue(value),
      removeItem: jest.fn().mockResolvedValue(undefined),
    };
  }

  it("should do nothing when there are no local bookmarks", async () => {
    const storage = makeStorage(null);
    const upload = jest.fn();

    const res = await migrateLocalVideoBookmarks({ videoId: 5, storageKey: key, storage, upload });

    expect(res).toEqual({ uploaded: 0, cleared: false });
    expect(upload).not.toHaveBeenCalled();
    expect(storage.removeItem).not.toHaveBeenCalled();
  });

  it("should upload every bookmark then remove the local key", async () => {
    const storage = makeStorage(JSON.stringify(local));
    const upload = jest.fn().mockResolvedValue(true);

    const res = await migrateLocalVideoBookmarks({ videoId: 5, storageKey: key, storage, upload });

    expect(upload).toHaveBeenCalledTimes(2);
    expect(storage.removeItem).toHaveBeenCalledWith(key);
    expect(res).toEqual({ uploaded: 2, cleared: true });
  });

  it("should keep the local key when any upload fails", async () => {
    const storage = makeStorage(JSON.stringify(local));
    const upload = jest.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    const res = await migrateLocalVideoBookmarks({ videoId: 5, storageKey: key, storage, upload });

    expect(storage.removeItem).not.toHaveBeenCalled();
    expect(res.cleared).toBe(false);
  });

  it("should keep the local key when an upload throws", async () => {
    const storage = makeStorage(JSON.stringify(local));
    const upload = jest.fn().mockRejectedValue(new Error("offline"));

    const res = await migrateLocalVideoBookmarks({ videoId: 5, storageKey: key, storage, upload });

    expect(storage.removeItem).not.toHaveBeenCalled();
    expect(res).toEqual({ uploaded: 0, cleared: false });
  });

  it("should leave an empty local list untouched", async () => {
    const storage = makeStorage("[]");
    const upload = jest.fn();

    const res = await migrateLocalVideoBookmarks({ videoId: 5, storageKey: key, storage, upload });

    expect(upload).not.toHaveBeenCalled();
    expect(res).toEqual({ uploaded: 0, cleared: false });
  });
});
