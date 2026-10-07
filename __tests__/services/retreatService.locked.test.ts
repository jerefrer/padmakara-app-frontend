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

const PREVIEW = {
  id: 7,
  titleEn: "Spring retreat",
  titlePt: null,
  startDate: "2026-04-12",
  endDate: "2026-04-13",
  imageUrl: null,
  teachers: [{ name: "Teacher" }],
  sessionCount: 4,
  audience: "free-subscribers",
};

function mockApi(map: Record<string, any>) {
  (apiService.get as jest.Mock).mockImplementation((endpoint: string) =>
    Promise.resolve(map[endpoint] ?? { success: false, status: 404 }),
  );
}

describe("retreatService.getRetreatDetails — locked events", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (entityCacheService.getDetail as jest.Mock).mockResolvedValue(null);
  });

  it("should return a membership lock with the preview when the API answers SUBSCRIPTION_REQUIRED", async () => {
    mockApi({
      "/events/7": { success: false, status: 403, code: "SUBSCRIPTION_REQUIRED", error: "x" },
      "/events/public/7": { success: false, status: 404 },
      "/events/7/preview": { success: true, data: PREVIEW },
    });

    const result = await retreatService.getRetreatDetails("7");

    expect(result.success).toBe(false);
    expect(result.locked).toEqual({ reason: "membership", preview: PREVIEW });
  });

  it("should return an auth lock when the API answers AUTH_REQUIRED", async () => {
    mockApi({
      "/events/7": { success: false, status: 401, code: "AUTH_REQUIRED", authRequired: true },
      "/events/7/preview": { success: true, data: PREVIEW },
    });

    const result = await retreatService.getRetreatDetails("7");

    expect(result.locked).toEqual({ reason: "auth", preview: PREVIEW });
  });

  it("should show the participants notice for a member-only retreat that has no preview (group retreats)", async () => {
    // The API 404s unknown and draft events before checking access, so a 403
    // SUBSCRIPTION_REQUIRED always means a published retreat exists. Only retreats open to
    // all members have a preview; a group retreat must not read as "not found".
    mockApi({
      "/events/7": { success: false, status: 403, code: "SUBSCRIPTION_REQUIRED" },
    });

    const result = await retreatService.getRetreatDetails("7");

    expect(result.success).toBe(false);
    expect(result.locked).toEqual({ reason: "other", preview: null });
  });

  it("should not report a lock for a signed-out visitor when no preview exists, since the event may not exist", async () => {
    mockApi({
      "/events/7": { success: false, status: 401, authRequired: true },
    });

    const result = await retreatService.getRetreatDetails("7");

    expect(result.locked).toBeUndefined();
  });

  it.each(["GROUP_MEMBERSHIP_REQUIRED", "EVENT_ATTENDANCE_REQUIRED", "ACCESS_DENIED"])(
    "should return reason other without calling preview when the API answers %s",
    async (code) => {
      mockApi({ "/events/7": { success: false, status: 403, code } });

      const result = await retreatService.getRetreatDetails("7");

      expect(result.locked).toEqual({ reason: "other", preview: null });
      const called = (apiService.get as jest.Mock).mock.calls.map((c) => c[0]);
      expect(called).not.toContain("/events/7/preview");
    },
  );

  it("should never cache a locked result", async () => {
    mockApi({
      "/events/7": { success: false, status: 403, code: "SUBSCRIPTION_REQUIRED" },
      "/events/7/preview": { success: true, data: PREVIEW },
    });

    await retreatService.getRetreatDetails("7");

    expect(entityCacheService.setDetail).not.toHaveBeenCalled();
  });

  it("should not report a lock when the failure is a plain network error", async () => {
    mockApi({ "/events/7": { success: false, error: "offline" } });

    const result = await retreatService.getRetreatDetails("7");

    expect(result.success).toBe(false);
    expect(result.locked).toBeUndefined();
  });
});
