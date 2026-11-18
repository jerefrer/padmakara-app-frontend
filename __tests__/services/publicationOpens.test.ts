import AsyncStorage from '@react-native-async-storage/async-storage';

import { publicationService } from '../../services/publicationService';
import apiService from '../../services/apiService';

jest.mock('../../services/apiService', () => ({
  __esModule: true,
  default: { post: jest.fn(() => Promise.resolve({ success: true })) },
}));

const NOW = Date.parse('2026-11-18T10:00:00.000Z');

beforeEach(() => {
  jest.spyOn(Date, 'now').mockReturnValue(NOW);
});

describe('publicationService.recordOpen', () => {
  it('should remember the open on this device', async () => {
    await publicationService.recordOpen('5', { signedIn: false });

    expect(await publicationService.getDeviceOpenTimes()).toEqual({ '5': NOW });
  });

  it('should keep the times of other publications', async () => {
    await AsyncStorage.setItem('@publication_opens', JSON.stringify({ '3': 1000 }));

    await publicationService.recordOpen('5', { signedIn: false });

    expect(await publicationService.getDeviceOpenTimes()).toEqual({ '3': 1000, '5': NOW });
  });

  it('should tell the server when signed in', async () => {
    await publicationService.recordOpen('5', { signedIn: true });

    expect(apiService.post).toHaveBeenCalledWith('/publications/5/opened');
  });

  it('should not call the server when signed out', async () => {
    await publicationService.recordOpen('5', { signedIn: false });

    expect(apiService.post).not.toHaveBeenCalled();
  });

  it('should still remember the open on this device when the server cannot be reached', async () => {
    (apiService.post as jest.Mock).mockRejectedValueOnce(new Error('offline'));

    await expect(publicationService.recordOpen('5', { signedIn: true })).resolves.toBeUndefined();

    expect(await publicationService.getDeviceOpenTimes()).toEqual({ '5': NOW });
  });
});

describe('publicationService.getDeviceOpenTimes', () => {
  it('should be empty before anything was opened', async () => {
    expect(await publicationService.getDeviceOpenTimes()).toEqual({});
  });

  it('should be empty when the stored value is unreadable', async () => {
    await AsyncStorage.setItem('@publication_opens', '{not json');

    expect(await publicationService.getDeviceOpenTimes()).toEqual({});
  });
});
