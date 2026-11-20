import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getLockScreenButtons,
  setLockScreenButtons,
  subscribeToLockScreenButtons,
} from '@/services/lockScreenButtonsPreference';

describe('lockScreenButtonsPreference', () => {
  it('should default to 15 second buttons when nothing was chosen', async () => {
    expect(await getLockScreenButtons()).toBe('seconds');
  });

  it('should fall back to the default when the stored value is unknown', async () => {
    await AsyncStorage.setItem('lockScreen.buttons', 'something-else');
    expect(await getLockScreenButtons()).toBe('seconds');
  });

  it('should keep the choice across reads', async () => {
    await setLockScreenButtons('tracks');
    expect(await getLockScreenButtons()).toBe('tracks');
  });

  it('should tell subscribers when the choice changes, until they unsubscribe', async () => {
    const listener = jest.fn();
    const unsubscribe = subscribeToLockScreenButtons(listener);
    await setLockScreenButtons('tracks');
    unsubscribe();
    await setLockScreenButtons('seconds');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith('tracks');
  });
});
