import AsyncStorage from '@react-native-async-storage/async-storage';
import magicLinkService from '@/services/magicLinkService';
import apiService from '@/services/apiService';
import * as tokenStorage from '@/services/tokenStorage';

jest.mock('@/services/apiService', () => ({ __esModule: true, default: { post: jest.fn() } }));
jest.mock('expo-device', () => ({ deviceName: 'Test', modelName: 'Test' }));
jest.mock('@/services/tokenStorage', () => ({
  setAuthToken: jest.fn().mockResolvedValue(undefined),
  setRefreshToken: jest.fn().mockResolvedValue(undefined),
  getAuthToken: jest.fn(),
  getRefreshToken: jest.fn(),
  deleteAuthToken: jest.fn(),
  deleteRefreshToken: jest.fn(),
  getPendingDeactivationRaw: jest.fn(),
  setPendingDeactivationRaw: jest.fn(),
  deletePendingDeactivation: jest.fn(),
}));

const post = (apiService as any).post as jest.Mock;
const ts = tokenStorage as unknown as Record<string, jest.Mock>;

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

describe('magicLinkService.reviewLogin', () => {
  it('should post the code with the device and store the tokens like an already activated device', async () => {
    post.mockResolvedValue({
      success: true,
      data: { status: 'already_activated', access_token: 'acc', refresh_token: 'ref', user: { id: '7' } },
    });

    const res = await magicLinkService.reviewLogin(' Review@Padmakara.pt ', ' demo-code ');

    expect(res.success).toBe(true);
    const [endpoint, body] = post.mock.calls[0];
    expect(endpoint).toBe('/auth/review-login');
    expect(body).toMatchObject({ email: 'review@padmakara.pt', code: 'demo-code' });
    expect(body.device_fingerprint).toBeTruthy();
    expect(ts.setAuthToken).toHaveBeenCalledWith('acc');
    expect(ts.setRefreshToken).toHaveBeenCalledWith('ref');
    expect(await AsyncStorage.getItem('device_activated')).toBe('true');
  });

  it('should report an incorrect code when the server answers 401 and store nothing', async () => {
    post.mockResolvedValue({ success: false, error: 'Authentication required.', authRequired: true });

    const res = await magicLinkService.reviewLogin('review@padmakara.pt', 'wrong-code');

    expect(res).toMatchObject({ success: false, incorrectCode: true });
    expect(ts.setAuthToken).not.toHaveBeenCalled();
  });

  it('should not call a server error an incorrect code', async () => {
    post.mockResolvedValue({ success: false, error: 'HTTP 500', status: 500 });

    const res = await magicLinkService.reviewLogin('review@padmakara.pt', 'demo-code');

    expect(res.incorrectCode).toBe(false);
  });
});
