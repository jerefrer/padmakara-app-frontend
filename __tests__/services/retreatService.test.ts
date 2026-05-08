import retreatService from "../../services/retreatService";
import entityCacheService from "../../services/entityCacheService";
import apiService from "../../services/apiService";

jest.mock("../../services/apiService", () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

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

// ─── F1: getUserRetreats ─────────────────────────────────────────────

describe("retreatService.getUserRetreats — SWR pattern", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns cached groups + events synchronously when cache is populated", async () => {
    (entityCacheService.getList as jest.Mock).mockImplementation(async (ns: string) => {
      if (ns === "groups") return [{ id: 1, name: "Mandala", updatedAt: "x" }];
      if (ns === "events")
        return [{
          id: 10,
          titleEn: "Event A",
          updatedAt: "y",
          eventRetreatGroups: [{ retreatGroupId: 1 }],
        }];
      return [];
    });

    const result = await retreatService.getUserRetreats();

    expect(result.success).toBe(true);
    expect(result.data?.retreat_groups).toHaveLength(1);
    expect(apiService.get).not.toHaveBeenCalled();
  });

  it("falls back to network when cache is empty (first launch)", async () => {
    (entityCacheService.getList as jest.Mock).mockResolvedValue(null);
    (apiService.get as jest.Mock).mockImplementation((endpoint: string) => {
      if (endpoint === "/groups") return Promise.resolve({ success: true, data: [] });
      if (endpoint === "/events") return Promise.resolve({ success: true, data: [] });
      return Promise.resolve({ success: false });
    });

    const result = await retreatService.getUserRetreats();

    expect(result.success).toBe(true);
    expect(apiService.get).toHaveBeenCalledWith("/groups");
    expect(apiService.get).toHaveBeenCalledWith("/events");
    expect(entityCacheService.setList).toHaveBeenCalledWith("groups", expect.any(Array));
    expect(entityCacheService.setList).toHaveBeenCalledWith("events", expect.any(Array));
  });

  it("returns authRequired:true when an auth check fails on cold path", async () => {
    (entityCacheService.getList as jest.Mock).mockResolvedValue(null);
    (apiService.get as jest.Mock).mockResolvedValue({
      success: false,
      authRequired: true,
      error: "auth required",
    });

    const result = await retreatService.getUserRetreats();
    expect(result.authRequired).toBe(true);
  });
});

// ─── F2: getRetreatGroupDetails ──────────────────────────────────────

describe("retreatService.getRetreatGroupDetails", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns from cache when group + its events are present", async () => {
    (entityCacheService.getList as jest.Mock).mockImplementation(async (ns: string) => {
      if (ns === "groups") return [{ id: 1, abbreviation: "MND", slug: "mandala", name: "Mandala", updatedAt: "x" }];
      if (ns === "events")
        return [{
          id: 10,
          titleEn: "Event A",
          updatedAt: "y",
          eventRetreatGroups: [{ retreatGroupId: 1 }],
        }];
      return [];
    });

    const result = await retreatService.getRetreatGroupDetails("MND");
    expect(result.success).toBe(true);
    expect(apiService.get).not.toHaveBeenCalled();
  });

  it("falls back to network when groups cache is empty", async () => {
    (entityCacheService.getList as jest.Mock).mockResolvedValue(null);
    (apiService.get as jest.Mock).mockImplementation((url: string) => {
      if (url.startsWith("/groups/MND/events")) return Promise.resolve({ success: true, data: [] });
      if (url === "/groups") return Promise.resolve({ success: true, data: [] });
      return Promise.resolve({ success: false });
    });

    const result = await retreatService.getRetreatGroupDetails("MND");
    expect(result.success).toBe(true);
    expect(apiService.get).toHaveBeenCalled();
  });
});

// ─── A4: getEventsByTeacher ──────────────────────────────────────────

describe("retreatService.getEventsByTeacher — SWR pattern", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns teacher + filtered events from cache on hit", async () => {
    (entityCacheService.getList as jest.Mock).mockResolvedValue([
      {
        id: 1,
        titleEn: "Event by JKR",
        eventTeachers: [{ teacher: { id: 5, name: "Jigme Khyentse Rinpoche", abbreviation: "JKR" } }],
      },
      {
        id: 2,
        titleEn: "Event by Other",
        eventTeachers: [{ teacher: { id: 6, name: "Other Teacher", abbreviation: "OT" } }],
      },
    ]);

    const result = await retreatService.getEventsByTeacher("JKR");

    expect(result.success).toBe(true);
    expect(result.events).toHaveLength(1);
    expect(result.events[0].id).toBe("1");
    expect(result.teacher?.abbreviation).toBe("JKR");
    expect(apiService.get).not.toHaveBeenCalled();
  });

  it("returns empty events array when teacher has no events in cache", async () => {
    (entityCacheService.getList as jest.Mock).mockResolvedValue([
      {
        id: 1,
        titleEn: "Event by Other",
        eventTeachers: [{ teacher: { id: 6, name: "Other", abbreviation: "OT" } }],
      },
    ]);

    const result = await retreatService.getEventsByTeacher("UNKNOWN");

    expect(result.success).toBe(true);
    expect(result.events).toHaveLength(0);
    expect(result.teacher).toBeNull();
    expect(apiService.get).not.toHaveBeenCalled();
  });

  it("falls back to network (via getPublicEvents) on cache miss", async () => {
    (entityCacheService.getList as jest.Mock).mockResolvedValue(null);
    (apiService.get as jest.Mock).mockResolvedValue({
      success: true,
      data: [
        {
          id: 3,
          titleEn: "Network Event",
          eventTeachers: [{ teacher: { abbreviation: "JKR", name: "Jigme Khyentse Rinpoche" } }],
          teachers: [{ abbreviation: "JKR", name: "Jigme Khyentse Rinpoche" }],
        },
      ],
    });

    const result = await retreatService.getEventsByTeacher("JKR");

    expect(result.success).toBe(true);
    expect(apiService.get).toHaveBeenCalledWith("/events/public");
  });
});

// ─── A1: getPublicEvents ─────────────────────────────────────────────

describe("retreatService.getPublicEvents — SWR pattern", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns only free-anyone events from cache on hit", async () => {
    (entityCacheService.getList as jest.Mock).mockResolvedValue([
      { id: 1, titleEn: "Public Event", audience: { slug: "free-anyone" } },
      { id: 2, titleEn: "Members Only", audience: { slug: "retreat-group-members" } },
    ]);

    const result = await retreatService.getPublicEvents();

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(1);
    expect(result.data![0].id).toBe("1");
    expect(apiService.get).not.toHaveBeenCalled();
  });

  it("falls back to /events/public on cache miss", async () => {
    (entityCacheService.getList as jest.Mock).mockResolvedValue(null);
    (apiService.get as jest.Mock).mockResolvedValue({
      success: true,
      data: [{ id: 5, titleEn: "Network Event" }],
    });

    const result = await retreatService.getPublicEvents();

    expect(result.success).toBe(true);
    expect(apiService.get).toHaveBeenCalledWith("/events/public");
  });

  it("returns empty array from cache when no public events exist", async () => {
    (entityCacheService.getList as jest.Mock).mockResolvedValue([
      { id: 2, titleEn: "Members Only", audience: { slug: "retreat-group-members" } },
    ]);

    const result = await retreatService.getPublicEvents();

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(0);
    expect(apiService.get).not.toHaveBeenCalled();
  });
});

// ─── A2: getFeaturedEvent ────────────────────────────────────────────

describe("retreatService.getFeaturedEvent — SWR pattern", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns event with most recent featuredAt from cache on hit", async () => {
    (entityCacheService.getList as jest.Mock).mockResolvedValue([
      { id: 10, titleEn: "Older Featured", featuredAt: "2024-01-01T00:00:00.000Z" },
      { id: 20, titleEn: "Newer Featured", featuredAt: "2025-03-01T00:00:00.000Z" },
      { id: 30, titleEn: "Not Featured" },
    ]);

    const result = await retreatService.getFeaturedEvent();

    expect(result.success).toBe(true);
    expect(result.data?.id).toBe("20");
    expect(apiService.get).not.toHaveBeenCalled();
  });

  it("returns null when cache has events but none has featuredAt", async () => {
    (entityCacheService.getList as jest.Mock).mockResolvedValue([
      { id: 10, titleEn: "Event A" },
    ]);

    const result = await retreatService.getFeaturedEvent();

    expect(result.success).toBe(true);
    expect(result.data).toBeNull();
    expect(apiService.get).not.toHaveBeenCalled();
  });

  it("falls back to /events/featured on cache miss", async () => {
    (entityCacheService.getList as jest.Mock).mockResolvedValue(null);
    (apiService.get as jest.Mock).mockResolvedValue({
      success: true,
      data: { id: 99, titleEn: "Featured From Network" },
    });

    const result = await retreatService.getFeaturedEvent();

    expect(result.success).toBe(true);
    expect(apiService.get).toHaveBeenCalledWith("/events/featured");
  });
});

// ─── F3: getRetreatDetails (event detail) ───────────────────────────
//
// Contract: the cache stores RAW backend data (same shape as syncService
// writes). assembleEventDetail maps on every read. Both cache-hit and
// cache-miss must return the same mapped+enriched shape.

describe("retreatService.getRetreatDetails (event detail)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const rawBackendEvent = {
    id: 42,
    titleEn: "Spring Retreat",
    titlePt: "Retiro de Primavera",
    startDate: "2025-04-10",
    endDate: "2025-04-14",
    eventTeachers: [
      {
        teacher: {
          id: 5,
          name: "Jigme Khyentse Rinpoche",
          abbreviation: "JKR",
          heroUrl: "https://example.com/hero.jpg",
          avatarUrl: null,
          heroMobileUrl: null,
          heroFocalX: 50,
          heroFocalY: 50,
          heroScale: 100,
          avatarUpdatedAt: null,
          heroUpdatedAt: null,
        },
      },
    ],
    eventRetreatGroups: [
      {
        retreatGroup: {
          id: 3,
          nameEn: "Mandala Group",
          namePt: "Grupo Mandala",
          heroUrl: "https://example.com/group-hero.jpg",
          avatarUrl: null,
          heroMobileUrl: null,
          heroFocalX: 50,
          heroFocalY: 50,
          heroScale: 100,
          avatarUpdatedAt: null,
          heroUpdatedAt: null,
        },
      },
    ],
    sessions: [
      {
        id: 100,
        titleEn: "Morning Practice",
        timePeriod: "morning",
        sessionDate: "2025-04-10",
        tracks: [
          { id: 200, title: "Opening", trackNumber: 1, durationSeconds: 3600 },
          { id: 201, title: "Teaching", trackNumber: 2, durationSeconds: 5400 },
        ],
      },
    ],
    transcripts: [
      {
        id: 7,
        language: "en",
        pageCount: 12,
        updatedAt: "2025-04-15T00:00:00.000Z",
        originalFilename: "transcript.pdf",
      },
    ],
  };

  it("cache hit: maps raw backend shape → frontend mapped shape", async () => {
    // Simulate syncService having stored RAW backend data in the cache.
    (entityCacheService.getDetail as jest.Mock).mockResolvedValue(rawBackendEvent);

    const result = await retreatService.getRetreatDetails("42");

    expect(result.success).toBe(true);
    expect(apiService.get).not.toHaveBeenCalled();

    // Mapped event fields
    expect(result.data.id).toBe("42");
    expect(result.data.name).toBe("Spring Retreat");

    // Teachers mapped from eventTeachers[].teacher
    expect(result.data.teachers).toHaveLength(1);
    expect(result.data.teachers[0].heroUrl).toBe("https://example.com/hero.jpg");

    // Sessions mapped: type comes from timePeriod
    expect(result.data.sessions).toHaveLength(1);
    expect(result.data.sessions[0].type).toBe("morning");

    // Tracks mapped: order comes from trackNumber
    expect(result.data.sessions[0].tracks).toHaveLength(2);
    expect(result.data.sessions[0].tracks[0].order).toBe(1);
    expect(result.data.sessions[0].tracks[1].order).toBe(2);

    // retreat_group enriched from eventRetreatGroups[0].retreatGroup
    expect(result.data.retreat_group).toBeDefined();
    expect(result.data.retreat_group.heroUrl).toBe("https://example.com/group-hero.jpg");
    expect(result.data.retreat_group.name).toBe("Mandala Group");

    // Transcripts enriched
    expect(result.data.transcripts).toHaveLength(1);
    expect(result.data.transcripts[0].language).toBe("en");
    expect(result.data.transcripts[0].pageCount).toBe(12);
  });

  it("cache miss: persists RAW backend data and returns mapped shape", async () => {
    (entityCacheService.getDetail as jest.Mock).mockResolvedValue(null);
    (apiService.get as jest.Mock).mockResolvedValue({
      success: true,
      data: rawBackendEvent,
    });

    const result = await retreatService.getRetreatDetails("42");

    expect(result.success).toBe(true);
    expect(apiService.get).toHaveBeenCalled();

    // setDetail must be called with the RAW response (not already-mapped data).
    expect(entityCacheService.setDetail).toHaveBeenCalledWith(
      "events",
      42,
      rawBackendEvent  // raw shape — has eventTeachers, timePeriod, trackNumber, etc.
    );

    // Returned data is still mapped.
    expect(result.data.sessions[0].type).toBe("morning");
    expect(result.data.sessions[0].tracks[0].order).toBe(1);
    expect(result.data.teachers[0].heroUrl).toBe("https://example.com/hero.jpg");
    expect(result.data.retreat_group.heroUrl).toBe("https://example.com/group-hero.jpg");
  });

  it("handles missing eventRetreatGroups gracefully (public endpoint response)", async () => {
    const minimalRaw = {
      id: 99,
      titleEn: "Public Event",
      startDate: "2025-06-01",
      endDate: "2025-06-03",
      // no eventRetreatGroups, no eventTeachers, no sessions, no transcripts
    };
    (entityCacheService.getDetail as jest.Mock).mockResolvedValue(minimalRaw);

    const result = await retreatService.getRetreatDetails("99");

    expect(result.success).toBe(true);
    expect(result.data.id).toBe("99");
    expect(result.data.retreat_group).toBeUndefined();
    expect(result.data.teachers).toBeUndefined();
    expect(result.data.transcripts).toHaveLength(0);
  });
});

// ─── Sync companion methods ──────────────────────────────────────────

describe("retreatService sync companions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── getUserRetreatsSync ──────────────────────────────────────────────

  describe("getUserRetreatsSync", () => {
    it("returns null when mirror is cold (undefined)", () => {
      (entityCacheService.getListSync as jest.Mock).mockReturnValue(undefined);
      expect(retreatService.getUserRetreatsSync()).toBeNull();
    });

    it("returns null when groups mirror is null (cache miss)", () => {
      (entityCacheService.getListSync as jest.Mock).mockImplementation((ns: string) => {
        if (ns === "groups") return null;
        return [{ id: 10, titleEn: "Event A", eventRetreatGroups: [] }];
      });
      expect(retreatService.getUserRetreatsSync()).toBeNull();
    });

    it("returns assembled data when both groups and events mirrors are populated", () => {
      (entityCacheService.getListSync as jest.Mock).mockImplementation((ns: string) => {
        if (ns === "groups") return [{ id: 1, nameEn: "Mandala", abbreviation: "MND", updatedAt: "x" }];
        if (ns === "events") return [{ id: 10, titleEn: "Event A", updatedAt: "y", eventRetreatGroups: [{ retreatGroupId: 1 }] }];
        return [];
      });
      const result = retreatService.getUserRetreatsSync();
      expect(result).not.toBeNull();
      expect(result!.retreat_groups).toHaveLength(1);
    });
  });

  // ── getRetreatGroupDetailsSync ───────────────────────────────────────

  describe("getRetreatGroupDetailsSync", () => {
    it("returns null when mirror is cold", () => {
      (entityCacheService.getListSync as jest.Mock).mockReturnValue(undefined);
      expect(retreatService.getRetreatGroupDetailsSync("MND")).toBeNull();
    });

    it("returns null when events mirror is null", () => {
      (entityCacheService.getListSync as jest.Mock).mockImplementation((ns: string) => {
        if (ns === "groups") return [{ id: 1, abbreviation: "MND", nameEn: "Mandala", updatedAt: "x" }];
        return null;
      });
      expect(retreatService.getRetreatGroupDetailsSync("MND")).toBeNull();
    });

    it("returns group details when both mirrors are populated", () => {
      (entityCacheService.getListSync as jest.Mock).mockImplementation((ns: string) => {
        if (ns === "groups") return [{ id: 1, abbreviation: "MND", nameEn: "Mandala", updatedAt: "x" }];
        if (ns === "events") return [{ id: 10, titleEn: "Event A", updatedAt: "y", eventRetreatGroups: [{ retreatGroupId: 1 }] }];
        return [];
      });
      const result = retreatService.getRetreatGroupDetailsSync("MND");
      expect(result).not.toBeNull();
      expect(result!.gatherings).toHaveLength(1);
    });
  });

  // ── getRetreatDetailsSync ────────────────────────────────────────────

  describe("getRetreatDetailsSync", () => {
    it("returns null when detail mirror is cold", () => {
      (entityCacheService.getDetailSync as jest.Mock).mockReturnValue(undefined);
      expect(retreatService.getRetreatDetailsSync("42")).toBeNull();
    });

    it("returns null when detail mirror is null (cache miss)", () => {
      (entityCacheService.getDetailSync as jest.Mock).mockReturnValue(null);
      expect(retreatService.getRetreatDetailsSync("42")).toBeNull();
    });

    it("returns mapped event detail when detail mirror is populated", () => {
      const rawEvent = {
        id: 42,
        titleEn: "Spring Retreat",
        startDate: "2025-04-10",
        endDate: "2025-04-14",
        transcripts: [],
      };
      (entityCacheService.getDetailSync as jest.Mock).mockReturnValue(rawEvent);
      const result = retreatService.getRetreatDetailsSync("42");
      expect(result).not.toBeNull();
      expect(result!.id).toBe("42");
      expect(result!.name).toBe("Spring Retreat");
    });
  });

  // ── getPublicEventsSync ──────────────────────────────────────────────

  describe("getPublicEventsSync", () => {
    it("returns null when events mirror is cold", () => {
      (entityCacheService.getListSync as jest.Mock).mockReturnValue(undefined);
      expect(retreatService.getPublicEventsSync()).toBeNull();
    });

    it("returns only free-anyone events when mirror is populated", () => {
      (entityCacheService.getListSync as jest.Mock).mockReturnValue([
        { id: 1, titleEn: "Public Event", audience: { slug: "free-anyone" } },
        { id: 2, titleEn: "Members Only", audience: { slug: "retreat-group-members" } },
      ]);
      const result = retreatService.getPublicEventsSync();
      expect(result).toHaveLength(1);
      expect(result![0].id).toBe("1");
    });
  });

  // ── getFeaturedEventSync ─────────────────────────────────────────────

  describe("getFeaturedEventSync", () => {
    it("returns null when events mirror is cold", () => {
      (entityCacheService.getListSync as jest.Mock).mockReturnValue(undefined);
      expect(retreatService.getFeaturedEventSync()).toBeNull();
    });

    it("returns the most recently featured event", () => {
      (entityCacheService.getListSync as jest.Mock).mockReturnValue([
        { id: 10, titleEn: "Older Featured", featuredAt: "2024-01-01T00:00:00.000Z" },
        { id: 20, titleEn: "Newer Featured", featuredAt: "2025-03-01T00:00:00.000Z" },
        { id: 30, titleEn: "Not Featured" },
      ]);
      const result = retreatService.getFeaturedEventSync();
      expect(result).not.toBeNull();
      expect(result!.id).toBe("20");
    });

    it("returns null when no event has featuredAt", () => {
      (entityCacheService.getListSync as jest.Mock).mockReturnValue([
        { id: 10, titleEn: "Event A" },
      ]);
      expect(retreatService.getFeaturedEventSync()).toBeNull();
    });
  });

  // ── getEventsByTeacherSync ───────────────────────────────────────────

  describe("getEventsByTeacherSync", () => {
    it("returns null when events mirror is cold", () => {
      (entityCacheService.getListSync as jest.Mock).mockReturnValue(undefined);
      expect(retreatService.getEventsByTeacherSync("JKR")).toBeNull();
    });

    it("returns filtered events and teacher when mirror is populated", () => {
      (entityCacheService.getListSync as jest.Mock).mockReturnValue([
        {
          id: 1,
          titleEn: "Event by JKR",
          eventTeachers: [{ teacher: { id: 5, name: "Jigme Khyentse Rinpoche", abbreviation: "JKR" } }],
        },
        {
          id: 2,
          titleEn: "Event by Other",
          eventTeachers: [{ teacher: { id: 6, name: "Other", abbreviation: "OT" } }],
        },
      ]);
      const result = retreatService.getEventsByTeacherSync("JKR");
      expect(result).not.toBeNull();
      expect(result!.events).toHaveLength(1);
      expect(result!.events[0].id).toBe("1");
      expect(result!.teacher?.abbreviation).toBe("JKR");
    });
  });
});

// ─── Phase A.4: force=true bypasses cache ────────────────────────────

describe("retreatService force=true — granular pull-to-refresh", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── getUserRetreats ──────────────────────────────────────────────────

  it("getUserRetreats: force=true hits network even when cache has data", async () => {
    // Cache has data, but force=true should skip it.
    (entityCacheService.getList as jest.Mock).mockImplementation(async (ns: string) => {
      if (ns === "groups") return [{ id: 1, nameEn: "Cached Group", updatedAt: "x" }];
      if (ns === "events") return [{ id: 10, titleEn: "Cached Event", updatedAt: "y", eventRetreatGroups: [] }];
      return [];
    });
    (apiService.get as jest.Mock).mockImplementation((endpoint: string) => {
      if (endpoint === "/groups") return Promise.resolve({ success: true, data: [{ id: 2, nameEn: "Fresh Group", updatedAt: "z" }] });
      if (endpoint === "/events") return Promise.resolve({ success: true, data: [{ id: 20, titleEn: "Fresh Event", updatedAt: "w", eventRetreatGroups: [] }] });
      return Promise.resolve({ success: false });
    });

    const result = await retreatService.getUserRetreats({ force: true });

    expect(apiService.get).toHaveBeenCalledWith("/groups");
    expect(apiService.get).toHaveBeenCalledWith("/events");
    expect(result.success).toBe(true);
    // Cache was updated with fresh data.
    expect(entityCacheService.setList).toHaveBeenCalledWith("groups", expect.any(Array));
    expect(entityCacheService.setList).toHaveBeenCalledWith("events", expect.any(Array));
  });

  // ── getRetreatGroupDetails ───────────────────────────────────────────

  it("getRetreatGroupDetails: force=true hits network even when cache has data", async () => {
    (entityCacheService.getList as jest.Mock).mockImplementation(async (ns: string) => {
      if (ns === "groups") return [{ id: 1, abbreviation: "MND", nameEn: "Mandala", updatedAt: "x" }];
      if (ns === "events") return [{ id: 10, titleEn: "Cached Event", updatedAt: "y", eventRetreatGroups: [{ retreatGroupId: 1 }] }];
      return [];
    });
    (apiService.get as jest.Mock).mockImplementation((url: string) => {
      if (url.includes("/groups/MND/events")) return Promise.resolve({ success: true, data: [{ id: 20, titleEn: "Fresh Event", updatedAt: "w" }] });
      if (url === "/groups") return Promise.resolve({ success: true, data: [] });
      return Promise.resolve({ success: false });
    });

    const result = await retreatService.getRetreatGroupDetails("MND", { force: true });

    expect(apiService.get).toHaveBeenCalled();
    expect(result.success).toBe(true);
  });

  // ── getRetreatDetails ────────────────────────────────────────────────

  it("getRetreatDetails: force=true hits network even when cache has data", async () => {
    const cachedRaw = { id: 42, titleEn: "Cached Retreat", startDate: "2025-04-10", endDate: "2025-04-14", transcripts: [] };
    const freshRaw = { id: 42, titleEn: "Fresh Retreat", startDate: "2025-04-10", endDate: "2025-04-14", transcripts: [] };
    (entityCacheService.getDetail as jest.Mock).mockResolvedValue(cachedRaw);
    (apiService.get as jest.Mock).mockResolvedValue({ success: true, data: freshRaw });

    const result = await retreatService.getRetreatDetails("42", { force: true });

    expect(apiService.get).toHaveBeenCalled();
    expect(result.success).toBe(true);
    // Cache was updated with fresh data.
    expect(entityCacheService.setDetail).toHaveBeenCalledWith("events", 42, freshRaw);
  });

  // ── getPublicEvents ──────────────────────────────────────────────────

  it("getPublicEvents: force=true hits network even when cache has data", async () => {
    (entityCacheService.getList as jest.Mock).mockResolvedValue([
      { id: 1, titleEn: "Cached Public Event", audience: { slug: "free-anyone" } },
    ]);
    (apiService.get as jest.Mock).mockResolvedValue({
      success: true,
      data: [{ id: 2, titleEn: "Fresh Network Event" }],
    });

    const result = await retreatService.getPublicEvents({ force: true });

    expect(apiService.get).toHaveBeenCalledWith("/events/public");
    expect(result.success).toBe(true);
  });

  // ── getFeaturedEvent ─────────────────────────────────────────────────

  it("getFeaturedEvent: force=true hits network even when cache has data", async () => {
    (entityCacheService.getList as jest.Mock).mockResolvedValue([
      { id: 10, titleEn: "Cached Featured", featuredAt: "2025-01-01T00:00:00.000Z" },
    ]);
    (apiService.get as jest.Mock).mockResolvedValue({
      success: true,
      data: { id: 99, titleEn: "Fresh Featured Event" },
    });

    const result = await retreatService.getFeaturedEvent({ force: true });

    expect(apiService.get).toHaveBeenCalledWith("/events/featured");
    expect(result.success).toBe(true);
  });

  // ── getEventsByTeacher ───────────────────────────────────────────────

  it("getEventsByTeacher: force=true hits network even when cache has data", async () => {
    (entityCacheService.getList as jest.Mock).mockResolvedValue([
      {
        id: 1,
        titleEn: "Cached Event by JKR",
        eventTeachers: [{ teacher: { id: 5, name: "Jigme Khyentse Rinpoche", abbreviation: "JKR" } }],
      },
    ]);
    (apiService.get as jest.Mock).mockResolvedValue({
      success: true,
      data: [
        {
          id: 2,
          titleEn: "Fresh Network Event",
          teachers: [{ abbreviation: "JKR", name: "Jigme Khyentse Rinpoche" }],
        },
      ],
    });

    const result = await retreatService.getEventsByTeacher("JKR", { force: true });

    expect(apiService.get).toHaveBeenCalled();
    expect(result.success).toBe(true);
  });
});
