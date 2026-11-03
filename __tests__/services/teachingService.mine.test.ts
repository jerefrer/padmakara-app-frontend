import { teachingService } from '@/services/teachingService';
import apiService from '@/services/apiService';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@/services/apiService', () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn() } }));
const get = apiService.get as jest.Mock;

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
});

describe('teachingService.mine', () => {
  it('should map the events returned by /teachings/mine', async () => {
    get.mockResolvedValue({ success: true, data: [{ id: 5, titleEn: 'Heart Sutra', startDate: '2026-04-12' }] });

    const res = await teachingService.mine();

    expect(get).toHaveBeenCalledWith('/teachings/mine');
    expect(res.success).toBe(true);
    expect(res.data.map((g) => g.id)).toEqual(['5']);
    expect(res.data[0].name).toBe('Heart Sutra');
  });

  it('should fall back to the last good list when the network fails', async () => {
    get.mockResolvedValueOnce({ success: true, data: [{ id: 5, titleEn: 'Heart Sutra' }] });
    await teachingService.mine();
    get.mockResolvedValueOnce({ success: false, error: 'offline' });

    const res = await teachingService.mine();

    expect(res.success).toBe(true);
    expect(res.data.map((g) => g.id)).toEqual(['5']);
  });

  it('should report failure with an empty list when nothing is cached', async () => {
    get.mockResolvedValue({ success: false, error: 'offline' });

    const res = await teachingService.mine();

    expect(res).toEqual({ success: false, data: [], error: 'offline' });
  });
});
