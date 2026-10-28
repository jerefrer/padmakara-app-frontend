import { getPasskeyWording } from '@/utils/passkeyWording';

const UA = {
  iphoneSafari:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  iphoneChrome:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.153 Mobile/15E148 Safari/604.1',
  ipadSafari:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  macSafari:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  macChrome:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  macFirefox: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:127.0) Gecko/20100101 Firefox/127.0',
  winChrome:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  winEdge:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0',
  androidChrome:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
  winFirefox: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0',
};

const web = (userAgent: string, maxTouchPoints = 0) => getPasskeyWording({ os: 'web', userAgent, maxTouchPoints });

describe('getPasskeyWording', () => {
  it('should use the Apple wording on native iOS', () => {
    expect(getPasskeyWording({ os: 'ios' })).toEqual({
      device: 'ios',
      method: 'ios',
      sync: 'apple',
      apple: true,
      tablet: false,
    });
  });

  it('should use the Google wording on native Android', () => {
    expect(getPasskeyWording({ os: 'android' })).toEqual({
      device: 'android',
      method: 'android',
      sync: 'google',
      apple: false,
      tablet: false,
    });
  });

  it('should use the Apple wording with Face ID or Touch ID on iPhone Safari', () => {
    expect(web(UA.iphoneSafari)).toMatchObject({ device: 'ios', method: 'ios', sync: 'apple', apple: true });
  });

  it('should use the Apple wording on Chrome for iPhone, which shares the iCloud Keychain', () => {
    expect(web(UA.iphoneChrome)).toMatchObject({ method: 'ios', sync: 'apple', apple: true });
  });

  it('should use the Apple wording with Face ID or Touch ID on iPad Safari, whose user agent says Mac', () => {
    expect(web(UA.ipadSafari, 5)).toMatchObject({ device: 'ios', method: 'ios', sync: 'apple', apple: true, tablet: true });
  });

  it('should use Touch ID and the Apple wording on Mac Safari', () => {
    expect(web(UA.macSafari)).toMatchObject({ device: 'mac', method: 'mac', sync: 'apple', apple: true });
  });

  it('should use the Google wording on Mac Chrome', () => {
    expect(web(UA.macChrome)).toMatchObject({ device: 'mac', method: 'desktop', sync: 'google', apple: false });
  });

  it('should use the generic wording on Mac Firefox', () => {
    expect(web(UA.macFirefox)).toMatchObject({ method: 'desktop', sync: 'other', apple: false });
  });

  it('should use the Google wording on Windows Chrome', () => {
    expect(web(UA.winChrome)).toMatchObject({ device: 'desktop', method: 'desktop', sync: 'google', apple: false });
  });

  it('should use the generic wording on Windows Edge', () => {
    expect(web(UA.winEdge)).toMatchObject({ device: 'desktop', method: 'desktop', sync: 'other', apple: false });
  });

  it('should use the Google wording on Android Chrome', () => {
    expect(web(UA.androidChrome)).toMatchObject({ device: 'android', method: 'desktop', sync: 'google', apple: false });
  });

  it('should use the generic wording on Windows Firefox', () => {
    expect(web(UA.winFirefox)).toMatchObject({ sync: 'other', apple: false });
  });

  it('should fall back to the generic wording when the user agent is empty', () => {
    expect(web('')).toEqual({ device: 'other', method: 'generic', sync: 'other', apple: false, tablet: false });
  });
});
