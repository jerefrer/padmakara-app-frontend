/**
 * Links to app.padmakara.pt open the installed app (iOS universal links,
 * Android app links), except sign-in and purchase pages, which must stay in
 * the browser: a sign-in link has to finish where it was asked for, and Apple
 * forbids payment inside the app. The app config and the AASA file served by
 * the site must list the same paths.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

import config, { APP_LINK_PATHS } from '../app.config';

type Component = { '/': string; exclude?: boolean };

const aasa = JSON.parse(
  readFileSync(join(__dirname, '../public/.well-known/apple-app-site-association'), 'utf8'),
);
const assetlinks = JSON.parse(readFileSync(join(__dirname, '../public/.well-known/assetlinks.json'), 'utf8'));

const iosComponents = (): Component[] => aasa.applinks.details[0].components;

/** Same matching as iOS: `*` is any run of characters, the rest is literal. */
const iosOpensInApp = (path: string) =>
  iosComponents().some((c) => new RegExp(`^${c['/'].replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`).test(path));

const androidData = () =>
  (config.android?.intentFilters ?? []).flatMap((f) => (f.autoVerify ? f.data ?? [] : [])) as Array<{
    path?: string;
    pathPrefix?: string;
  }>;

const androidOpensInApp = (path: string) =>
  androidData().some((d) => (d.path !== undefined ? d.path === path : d.pathPrefix ? path.startsWith(d.pathPrefix) : false));

const IN_APP = ['/', '/retreats', '/retreat/12', '/teacher/JKR', '/transcript/9', '/publications', '/search', '/settings/storage'];
const IN_BROWSER = ['/get/12', '/get/12/done', '/membership', '/membership/pay', '/magic-link', '/check-email', '/device-activated', '/account-deletion'];

describe('app links', () => {
  it('should declare app.padmakara.pt for universal links on iOS', () => {
    expect(config.ios?.associatedDomains).toContain('applinks:app.padmakara.pt');
  });

  it('should list the app id in the AASA file served by the site', () => {
    expect(aasa.applinks.details[0].appIDs).toEqual(['8A879BZ53C.org.padmakara.pt']);
    expect(aasa.webcredentials.apps).toEqual(['8A879BZ53C.org.padmakara.pt']);
  });

  it.each(IN_APP)('should open %s in the app on iOS and Android', (path) => {
    expect(iosOpensInApp(path)).toBe(true);
    expect(androidOpensInApp(path)).toBe(true);
  });

  it.each(IN_BROWSER)('should keep %s in the browser on iOS and Android', (path) => {
    expect(iosOpensInApp(path)).toBe(false);
    expect(androidOpensInApp(path)).toBe(false);
  });

  it('should build the AASA components from the same path list as the app config', () => {
    const expected = APP_LINK_PATHS.flatMap((p) => (p === '/' ? [{ '/': '/' }] : [{ '/': p }, { '/': `${p}/*` }]));
    expect(iosComponents()).toEqual(expected);
  });

  it('should verify Android app links with the Play app-signing certificate', () => {
    const statement = assetlinks.find((s: { relation: string[] }) =>
      s.relation.includes('delegate_permission/common.handle_all_urls'),
    );
    expect(statement.target.package_name).toBe('org.padmakara.pt');
    expect(statement.target.sha256_cert_fingerprints).toContain(
      '7E:79:0A:92:3D:C7:CB:76:4B:6C:21:68:14:C3:A4:15:07:FC:A0:1C:DB:F7:3C:7F:BF:20:56:82:F0:11:59:8F',
    );
  });
});
