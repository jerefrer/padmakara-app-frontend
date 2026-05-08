import AsyncStorage from "@react-native-async-storage/async-storage";
import { EntityCacheService, NamespaceVersion } from "../../services/entityCacheService";

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  multiGet: jest.fn(),
  multiSet: jest.fn(),
}));

describe("EntityCacheService", () => {
  let svc: EntityCacheService;

  beforeEach(() => {
    jest.clearAllMocks();
    svc = new EntityCacheService();
  });

  describe("getList / setList", () => {
    it("returns null when no list is cached", async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
      const result = await svc.getList("events");
      expect(result).toBeNull();
    });

    it("round-trips a list", async () => {
      const list = [{ id: 1, updatedAt: "2026-05-08T00:00:00Z" }];
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
      await svc.setList("events", list);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        "@padmakara_cache:events:list",
        JSON.stringify(list),
      );

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(list));
      const fetched = await svc.getList("events");
      expect(fetched).toEqual(list);
    });
  });

  describe("getDetail / setDetail", () => {
    it("returns null when no detail is cached", async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
      const result = await svc.getDetail("events", 42);
      expect(result).toBeNull();
    });

    it("round-trips a detail object keyed by id", async () => {
      const detail = { id: 42, title: "Test Event", sessions: [] };
      await svc.setDetail("events", 42, detail);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        "@padmakara_cache:events:detail:42",
        JSON.stringify(detail),
      );

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(detail));
      const fetched = await svc.getDetail("events", 42);
      expect(fetched).toEqual(detail);
    });
  });

  describe("getNamespaceVersion / setNamespaceVersion — tuple shape", () => {
    it("returns null when no version is stored", async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
      expect(await svc.getNamespaceVersion("events")).toBeNull();
    });

    it("round-trips a {global, user} tuple", async () => {
      const version: NamespaceVersion = { global: 42, user: 7 };
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
      await svc.setNamespaceVersion("events", version);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        "@padmakara_cache:events:version",
        JSON.stringify(version),
      );

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(version));
      expect(await svc.getNamespaceVersion("events")).toEqual(version);
    });

    it("returns null for malformed stored data (legacy bare number)", async () => {
      // Schema version 1 stored bare numbers; after upgrade + wipe the value
      // won't exist, but guard against any residual bad data.
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue("42");
      expect(await svc.getNamespaceVersion("events")).toBeNull();
    });

    it("returns null for broken JSON", async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue("{broken");
      expect(await svc.getNamespaceVersion("events")).toBeNull();
    });

    it("returns null for object missing required fields", async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify({ global: 5 }));
      expect(await svc.getNamespaceVersion("events")).toBeNull();
    });
  });

  // ─── In-memory mirror ────────────────────────────────────────────────

  describe("getListSync — in-memory mirror", () => {
    it("returns undefined before any read or write (mirror cold)", () => {
      expect(svc.getListSync("events")).toBeUndefined();
    });

    it("returns data immediately after setList (write populates mirror)", async () => {
      const list = [{ id: 1, name: "Test" }];
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
      await svc.setList("events", list);
      // No getList call needed — setList must have populated the mirror.
      expect(svc.getListSync("events")).toEqual(list);
    });

    it("returns null after getList resolves with null (cache miss known)", async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
      await svc.getList("events");
      expect(svc.getListSync("events")).toBeNull();
    });

    it("returns the cached data after getList resolves with data", async () => {
      const list = [{ id: 2, name: "Another" }];
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(list));
      await svc.getList("events");
      expect(svc.getListSync("events")).toEqual(list);
    });

    it("returns null in mirror after getList encounters broken JSON", async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue("not-json{{{");
      await svc.getList("events");
      expect(svc.getListSync("events")).toBeNull();
    });

    it("returns undefined for a namespace not yet touched", () => {
      // Populate one namespace, leave the other cold.
      expect(svc.getListSync("groups")).toBeUndefined();
    });

    it("clears mirror for all namespaces after clearMemory", async () => {
      const list = [{ id: 1 }];
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
      await svc.setList("events", list);
      await svc.setList("groups", list);
      expect(svc.getListSync("events")).toEqual(list);
      expect(svc.getListSync("groups")).toEqual(list);

      svc.clearMemory();

      expect(svc.getListSync("events")).toBeUndefined();
      expect(svc.getListSync("groups")).toBeUndefined();
    });
  });

  describe("getDetailSync — in-memory mirror", () => {
    it("returns undefined before any read or write (mirror cold)", () => {
      expect(svc.getDetailSync("events", 42)).toBeUndefined();
    });

    it("returns data immediately after setDetail", async () => {
      const detail = { id: 42, title: "Spring Retreat" };
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
      await svc.setDetail("events", 42, detail);
      expect(svc.getDetailSync("events", 42)).toEqual(detail);
    });

    it("returns null after getDetail resolves with null (cache miss)", async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
      await svc.getDetail("events", 42);
      expect(svc.getDetailSync("events", 42)).toBeNull();
    });

    it("returns the value after getDetail resolves with data", async () => {
      const detail = { id: 42, title: "Spring Retreat" };
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(detail));
      await svc.getDetail("events", 42);
      expect(svc.getDetailSync("events", 42)).toEqual(detail);
    });

    it("returns null in mirror after getDetail encounters broken JSON", async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue("{broken");
      await svc.getDetail("events", 42);
      expect(svc.getDetailSync("events", 42)).toBeNull();
    });

    it("returns undefined for an id not yet touched", async () => {
      const detail = { id: 42 };
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
      await svc.setDetail("events", 42, detail);
      expect(svc.getDetailSync("events", 99)).toBeUndefined();
    });

    it("clears detail mirror after clearMemory", async () => {
      const detail = { id: 42 };
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
      await svc.setDetail("events", 42, detail);
      svc.clearMemory();
      expect(svc.getDetailSync("events", 42)).toBeUndefined();
    });
  });

  describe("getNamespaceVersionSync — in-memory mirror", () => {
    it("returns undefined before any read or write (mirror cold)", () => {
      expect(svc.getNamespaceVersionSync("events")).toBeUndefined();
    });

    it("returns version tuple immediately after setNamespaceVersion", async () => {
      const version: NamespaceVersion = { global: 7, user: 3 };
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
      await svc.setNamespaceVersion("events", version);
      expect(svc.getNamespaceVersionSync("events")).toEqual(version);
    });

    it("returns null after getNamespaceVersion resolves with null", async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
      await svc.getNamespaceVersion("events");
      expect(svc.getNamespaceVersionSync("events")).toBeNull();
    });

    it("returns version tuple after getNamespaceVersion resolves with data", async () => {
      const version: NamespaceVersion = { global: 5, user: 2 };
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(version));
      await svc.getNamespaceVersion("events");
      expect(svc.getNamespaceVersionSync("events")).toEqual(version);
    });

    it("clears version mirror after clearMemory", async () => {
      const version: NamespaceVersion = { global: 3, user: 1 };
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
      await svc.setNamespaceVersion("events", version);
      svc.clearMemory();
      expect(svc.getNamespaceVersionSync("events")).toBeUndefined();
    });
  });

  describe("mirror read-through — no extra AsyncStorage calls", () => {
    it("does not call AsyncStorage.getItem on second getList call when mirror is warm", async () => {
      const list = [{ id: 1 }];
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(list));
      await svc.getList("events");
      await svc.getList("events"); // second call — should hit mirror
      // AsyncStorage.getItem should only have been called once.
      expect(AsyncStorage.getItem).toHaveBeenCalledTimes(1);
    });
  });
});
