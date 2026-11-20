import { appVersionLabel } from '@/utils/appVersion';

const mockApp: { nativeApplicationVersion: string | null; nativeBuildVersion: string | null } = {
  nativeApplicationVersion: null,
  nativeBuildVersion: null,
};
jest.mock('expo-application', () => ({
  get nativeApplicationVersion() { return mockApp.nativeApplicationVersion; },
  get nativeBuildVersion() { return mockApp.nativeBuildVersion; },
}));
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { version: '1.0.0' } } }));

describe('appVersionLabel', () => {
  it('should append the build number when the binary has one', () => {
    mockApp.nativeApplicationVersion = '1.2.0';
    mockApp.nativeBuildVersion = '36';

    expect(appVersionLabel()).toBe('1.2.0 (36)');
  });

  it('should show only the config version when there is no native build (web)', () => {
    mockApp.nativeApplicationVersion = null;
    mockApp.nativeBuildVersion = null;

    expect(appVersionLabel()).toBe('1.0.0');
  });
});
