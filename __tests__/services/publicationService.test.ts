import { publicationService } from "../../services/publicationService";
import entityCacheService from "../../services/entityCacheService";

// Mock entityCacheService
jest.mock("../../services/entityCacheService", () => {
  const inst = {
    getList: jest.fn(),
    setList: jest.fn(),
    getDetail: jest.fn(),
    setDetail: jest.fn(),
    getNamespaceVersion: jest.fn(),
    setNamespaceVersion: jest.fn(),
    getListSync: jest.fn(),
    getDetailSync: jest.fn(),
    getNamespaceVersionSync: jest.fn(),
    clearMemory: jest.fn(),
  };
  return { __esModule: true, default: inst, EntityCacheService: jest.fn(() => inst) };
});

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

// ─── A3: getPublications ─────────────────────────────────────────────

describe("publicationService.getPublications — SWR pattern", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns cached publications on hit, hasHiddenPublications defaults to false", async () => {
    const cachedPubs = [
      { id: "1", title: "Book A", updatedAt: "2024-01-01" },
      { id: "2", title: "Book B", updatedAt: "2024-02-01" },
    ];
    (entityCacheService.getList as jest.Mock).mockResolvedValue(cachedPubs);

    const result = await publicationService.getPublications();

    expect(result.publications).toHaveLength(2);
    expect(result.publications[0].title).toBe("Book A");
    expect(result.hasHiddenPublications).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("falls back to network on cache miss and persists the list", async () => {
    (entityCacheService.getList as jest.Mock).mockResolvedValue(null);

    const networkPubs = [
      { id: "10", title: "Network Book", updatedAt: "2025-01-01" },
    ];
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ publications: networkPubs, hasHiddenPublications: true }),
    });

    const result = await publicationService.getPublications();

    expect(result.publications).toHaveLength(1);
    expect(result.hasHiddenPublications).toBe(true);
    expect(mockFetch).toHaveBeenCalled();
    expect(entityCacheService.setList).toHaveBeenCalledWith(
      "publications",
      networkPubs,
    );
  });

  it("bypasses cache and hits network when sort param is provided", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ publications: [], hasHiddenPublications: false }),
    });

    await publicationService.getPublications("title");

    expect(entityCacheService.getList).not.toHaveBeenCalled();
    expect(mockFetch).toHaveBeenCalled();
    // Should not persist filtered results
    expect(entityCacheService.setList).not.toHaveBeenCalled();
  });

  it("throws when network fails on cache miss", async () => {
    (entityCacheService.getList as jest.Mock).mockResolvedValue(null);
    mockFetch.mockResolvedValue({ ok: false, status: 500 });

    await expect(publicationService.getPublications()).rejects.toThrow(
      "Failed to fetch publications: 500",
    );
  });
});

// ─── Phase A.4: force=true bypasses cache ────────────────────────────

describe("publicationService.getPublications — force=true", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("force=true hits network even when cache has data", async () => {
    const cachedPubs = [{ id: "1", title: "Cached Book", updatedAt: "2024-01-01" }];
    const freshPubs = [{ id: "99", title: "Fresh Book", updatedAt: "2025-01-01" }];
    (entityCacheService.getList as jest.Mock).mockResolvedValue(cachedPubs);
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ publications: freshPubs, hasHiddenPublications: false }),
    });

    const result = await publicationService.getPublications(undefined, undefined, { force: true });

    expect(mockFetch).toHaveBeenCalled();
    expect(result.publications).toHaveLength(1);
    expect(result.publications[0].title).toBe("Fresh Book");
    // Cache is updated with fresh data.
    expect(entityCacheService.setList).toHaveBeenCalledWith("publications", freshPubs);
  });
});

// ─── A5: getPublicationsSync ─────────────────────────────────────────

describe("publicationService.getPublicationsSync", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns null when mirror is cold (undefined)", () => {
    (entityCacheService.getListSync as jest.Mock).mockReturnValue(undefined);
    expect(publicationService.getPublicationsSync()).toBeNull();
  });

  it("returns null when mirror is null (cache miss)", () => {
    (entityCacheService.getListSync as jest.Mock).mockReturnValue(null);
    expect(publicationService.getPublicationsSync()).toBeNull();
  });

  it("returns publications wrapped in the expected shape when mirror is populated", () => {
    const pubs = [
      { id: "1", title: "Book A", updatedAt: "2024-01-01" },
      { id: "2", title: "Book B", updatedAt: "2024-02-01" },
    ];
    (entityCacheService.getListSync as jest.Mock).mockReturnValue(pubs);
    const result = publicationService.getPublicationsSync();
    expect(result).not.toBeNull();
    expect(result!.publications).toHaveLength(2);
    expect(result!.hasHiddenPublications).toBe(false);
  });
});
