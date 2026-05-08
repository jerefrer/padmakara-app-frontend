import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  ensureCacheSchemaCurrent,
  CACHE_SCHEMA_VERSION,
  CACHE_KEY_PREFIX,
} from "../../services/cacheSchemaVersion";

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  getAllKeys: jest.fn(),
  multiRemove: jest.fn(),
}));

// Mock entityCacheService so we can assert clearMemory is called.
const mockClearMemory = jest.fn();
jest.mock("../../services/entityCacheService", () => ({
  __esModule: true,
  default: { clearMemory: mockClearMemory },
}));

describe("ensureCacheSchemaCurrent", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("does nothing if stored version equals current", async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(String(CACHE_SCHEMA_VERSION));
    await ensureCacheSchemaCurrent();
    expect(AsyncStorage.multiRemove).not.toHaveBeenCalled();
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    expect(mockClearMemory).not.toHaveBeenCalled();
  });

  it("wipes all cache-prefixed keys and writes the new version when stored is older", async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue("0");
    (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValue([
      `${CACHE_KEY_PREFIX}events:list`,
      `${CACHE_KEY_PREFIX}groups:list`,
      "auth_token",
      "@retreat_cache:user_retreats",
    ]);
    await ensureCacheSchemaCurrent();
    expect(AsyncStorage.multiRemove).toHaveBeenCalledWith([
      `${CACHE_KEY_PREFIX}events:list`,
      `${CACHE_KEY_PREFIX}groups:list`,
      "@retreat_cache:user_retreats",
    ]);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      "@cache_schema_version",
      String(CACHE_SCHEMA_VERSION),
    );
    // Memory mirror must be cleared after AsyncStorage wipe.
    expect(mockClearMemory).toHaveBeenCalledTimes(1);
  });

  it("treats missing stored version as a fresh install (writes current, no wipe, no clearMemory)", async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValue([]);
    await ensureCacheSchemaCurrent();
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      "@cache_schema_version",
      String(CACHE_SCHEMA_VERSION),
    );
    // Fresh install — no existing data, so no memory to clear.
    expect(mockClearMemory).not.toHaveBeenCalled();
  });
});
