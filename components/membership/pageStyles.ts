import { StyleSheet } from 'react-native';
import { membershipColors as c, fonts } from './theme';

/** Vertical rhythm shared by the membership pages; blocks are separated like the sections of Settings. */
export const space = { title: 20, block: 32, tight: 10, action: 24, fine: 14 } as const;

/**
 * The look of app/(tabs)/settings.tsx (desktopPageTitle, sectionTitleOutside, settingItem,
 * signInButton), shared by the manage page, the terms page and the outcome screens.
 */
export const pageStyles = StyleSheet.create({
  container: { width: '100%', maxWidth: 640, alignSelf: 'center', paddingHorizontal: 20, paddingBottom: 40 },
  title: {
    fontSize: 30,
    fontFamily: 'MinionPro',
    color: c.burgundy[500],
    fontVariant: ['small-caps'],
    letterSpacing: 0.5,
    marginTop: 24,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: c.gray[500],
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginTop: space.block,
    marginBottom: space.tight,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: c.gray[200],
  },
  rowPressed: { backgroundColor: c.gray[100], opacity: 0.8 },
  rowLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  rowTitle: { fontSize: 16, fontWeight: '500', color: c.gray[800], marginLeft: 12 },
  rowRight: { flexDirection: 'row', alignItems: 'center' },
  rowValue: { fontSize: 14, color: c.gray[600], marginRight: 8, flexShrink: 1, textAlign: 'right' },
  body: { fontSize: 16, lineHeight: 24, color: c.gray[700] },
  button: {
    alignSelf: 'flex-start',
    backgroundColor: c.burgundy[500],
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 2,
  },
  buttonPressed: { backgroundColor: c.burgundy[600] },
  buttonText: { color: 'white', fontSize: 16, fontWeight: '600', fontFamily: 'EBGaramond_600SemiBold' },
  link: { color: c.burgundy[500], fontSize: 16, fontFamily: fonts.display },
});
