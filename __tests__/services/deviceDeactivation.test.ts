import magicLinkService from '@/services/magicLinkService';
import * as tokenStorage from '@/services/tokenStorage';

jest.mock('@/services/apiService', () => ({ __esModule: true, default: {} }));
jest.mock('expo-device', () => ({ deviceName: 'Test', modelName: 'Test' }));
jest.mock('@/services/tokenStorage', () => ({
  getAuthToken: jest.fn(),
  getRefreshToken: jest.fn(),
  setAuthToken: jest.fn(),
  setRefreshToken: jest.fn(),
  deleteAuthToken: jest.fn(),
  deleteRefreshToken: jest.fn(),
  getPendingDeactivationRaw: jest.fn(),
  setPendingDeactivationRaw: jest.fn().mockResolvedValue(undefined),
  deletePendingDeactivation: jest.fn().mockResolvedValue(undefined),
}));

const ts = tokenStorage as unknown as Record<string, jest.Mock>;
const fetchMock = jest.fn();
const record = { fingerprint: 'fp-1', accessToken: 'acc', refreshToken: 'ref' };
const res = (status: number, body: unknown = {}) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

beforeEach(() => {
  jest.clearAllMocks();
  (global as any).fetch = fetchMock;
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('deactivateInBackground', () => {
  it('should send the captured token and fingerprint and store nothing on success', async () => {
    fetchMock.mockResolvedValue(res(200));
    await magicLinkService.deactivateInBackground(record);
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBe('Bearer acc');
    expect(JSON.parse(init.body)).toEqual({ device_fingerprint: 'fp-1' });
    expect(ts.setPendingDeactivationRaw).not.toHaveBeenCalled();
  });

  it('should store a pending record when the network fails', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    await magicLinkService.deactivateInBackground(record);
    expect(ts.setPendingDeactivationRaw).toHaveBeenCalledWith(JSON.stringify(record));
  });

  it('should store a pending record on a server error', async () => {
    fetchMock.mockResolvedValue(res(503));
    await magicLinkService.deactivateInBackground(record);
    expect(ts.setPendingDeactivationRaw).toHaveBeenCalled();
  });

  it('should refresh an expired access token without touching stored tokens', async () => {
    fetchMock
      .mockResolvedValueOnce(res(401))
      .mockResolvedValueOnce(res(200, { accessToken: 'new' }))
      .mockResolvedValueOnce(res(200));
    await magicLinkService.deactivateInBackground(record);
    expect(fetchMock.mock.calls[2][1].headers.Authorization).toBe('Bearer new');
    expect(ts.setAuthToken).not.toHaveBeenCalled();
    expect(ts.setPendingDeactivationRaw).not.toHaveBeenCalled();
  });

  it('should drop the record when the refresh token is rejected', async () => {
    fetchMock.mockResolvedValueOnce(res(401)).mockResolvedValueOnce(res(401));
    await magicLinkService.deactivateInBackground(record);
    expect(ts.setPendingDeactivationRaw).not.toHaveBeenCalled();
  });
});

describe('retryPendingDeactivation', () => {
  beforeEach(() => {
    jest.spyOn(magicLinkService, 'isDeviceActivated').mockResolvedValue(false);
  });

  it('should send the stored request and delete the record', async () => {
    ts.getPendingDeactivationRaw.mockResolvedValue(JSON.stringify(record));
    fetchMock.mockResolvedValue(res(200));
    await magicLinkService.retryPendingDeactivation();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(ts.deletePendingDeactivation).toHaveBeenCalled();
  });

  it('should delete the record even when the retry fails again', async () => {
    ts.getPendingDeactivationRaw.mockResolvedValue(JSON.stringify(record));
    fetchMock.mockRejectedValue(new Error('offline'));
    await magicLinkService.retryPendingDeactivation();
    expect(ts.deletePendingDeactivation).toHaveBeenCalled();
  });

  it('should do nothing when no record is stored', async () => {
    ts.getPendingDeactivationRaw.mockResolvedValue(null);
    await magicLinkService.retryPendingDeactivation();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('should drop the record without sending when the device was activated again', async () => {
    ts.getPendingDeactivationRaw.mockResolvedValue(JSON.stringify(record));
    (magicLinkService.isDeviceActivated as jest.Mock).mockResolvedValue(true);
    await magicLinkService.retryPendingDeactivation();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(ts.deletePendingDeactivation).toHaveBeenCalled();
  });
});
