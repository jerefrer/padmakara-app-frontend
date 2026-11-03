import { Platform } from 'react-native';
const originalOS = Platform.OS;
const mockHideAsync = jest.fn(() => Promise.resolve());
let mockLockAtStart: boolean | null = false;

jest.mock('expo-splash-screen', () => ({ hideAsync: () => mockHideAsync() }));
jest.mock('@/services/appLock', () => ({ appLockEnabledAtStart: () => mockLockAtStart }));

function load() {
  let mod!: typeof import('../../utils/splashHandoff');
  jest.isolateModules(() => {
    mod = require('../../utils/splashHandoff');
  });
  return mod;
}

describe('splash handoff', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockHideAsync.mockClear();
    mockLockAtStart = false;
  });
  afterEach(() => jest.useRealTimers());

  it('should lift the splash only after the first screen has drawn', () => {
    // Jérémy: a black screen showed between the splash and the home.
    const { firstScreenDrawn } = load();

    firstScreenDrawn();
    expect(mockHideAsync).not.toHaveBeenCalled();
    jest.runOnlyPendingTimers();

    expect(mockHideAsync).toHaveBeenCalledTimes(1);
  });

  it('should lift the splash once when several screens report', () => {
    const { firstScreenDrawn, liftSplash } = load();

    firstScreenDrawn();
    jest.runOnlyPendingTimers();
    liftSplash();
    firstScreenDrawn();
    jest.runOnlyPendingTimers();

    expect(mockHideAsync).toHaveBeenCalledTimes(1);
  });

  it('should leave the splash to the app lock when the lock is on at start', () => {
    mockLockAtStart = true;
    const { firstScreenDrawn } = load();

    firstScreenDrawn();
    jest.runOnlyPendingTimers();

    expect(mockHideAsync).not.toHaveBeenCalled();
  });
});

describe('splash handoff on Android', () => {
  it('should notify the cover instead of hiding the native splash', () => {
    (Platform as any).OS = 'android';
    mockHideAsync.mockClear();
    const { liftSplash, subscribeSplashLift } = load();
    const listener = jest.fn();
    subscribeSplashLift(listener);

    liftSplash();
    liftSplash();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(mockHideAsync).not.toHaveBeenCalled();
    (Platform as any).OS = originalOS;
  });
});
