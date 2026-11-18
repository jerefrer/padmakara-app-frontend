import en from '../../locales/en.json';
import pt from '../../locales/pt.json';
import { guestIntroLabel, guestLine, guestTeachers, mainTeacherNames, mainTeachers } from '@/utils/eventTeachers';

const translator = (tree: unknown) => (key: string): string | undefined => {
  const value = key.split('.').reduce<any>((node, k) => node?.[k], tree);
  return typeof value === 'string' ? value : undefined;
};
const tEn = translator(en);
const tPt = translator(pt);

const lembrun = {
  guestIntro: 'with_presence_of',
  teachers: [
    { name: 'Jigme Khyentse Rinpoche', role: 'teacher' },
    { name: 'Pema Wangyal Rinpoche', role: 'teacher' },
    { name: 'Shechen Rabjam Rinpoche', role: 'guest' },
  ],
};

describe('mainTeachers / guestTeachers', () => {
  it('should split the main teachers from the guests', () => {
    expect(mainTeacherNames(lembrun.teachers)).toBe('Jigme Khyentse Rinpoche, Pema Wangyal Rinpoche');
    expect(guestTeachers(lembrun.teachers).map((g) => g.name)).toEqual(['Shechen Rabjam Rinpoche']);
  });

  it('should treat teachers without a role (an older cached copy) as main teachers', () => {
    const teachers = [{ name: 'A' }, { name: 'B' }];
    expect(mainTeachers(teachers)).toEqual(teachers);
    expect(guestTeachers(teachers)).toEqual([]);
  });

  it('should let guests stand in when an event has no main teacher', () => {
    const teachers = [{ name: 'G', role: 'guest' }];
    expect(mainTeacherNames(teachers)).toBe('G');
    expect(guestTeachers(teachers)).toEqual([]);
  });
});

describe('guestLine', () => {
  it('should read "with the presence of …" in English', () => {
    expect(guestLine(lembrun, tEn)).toBe('with the presence of Shechen Rabjam Rinpoche');
  });

  it('should read "com a presença de …" in Portuguese', () => {
    expect(guestLine(lembrun, tPt)).toBe('com a presença de Shechen Rabjam Rinpoche');
  });

  it('should use the default phrase when the event has none', () => {
    expect(guestLine({ ...lembrun, guestIntro: null }, tPt)).toBe('com a presença de Shechen Rabjam Rinpoche');
  });

  it('should join several guests', () => {
    const event = {
      guestIntro: 'practice_sessions_by',
      teachers: [{ name: 'M', role: 'teacher' }, { name: 'G1', role: 'guest' }, { name: 'G2', role: 'guest' }],
    };
    expect(guestLine(event, tEn)).toBe('practice sessions by G1, G2');
  });

  it('should be null when the event has no guests', () => {
    expect(guestLine({ teachers: [{ name: 'M', role: 'teacher' }] }, tEn)).toBeNull();
  });

  it('should fall back to English when no translation is loaded', () => {
    expect(guestLine(lembrun, () => undefined)).toBe('with the presence of Shechen Rabjam Rinpoche');
  });
});

describe('guestIntroLabel', () => {
  it.each([
    ['with_presence_of', 'with the presence of', 'com a presença de'],
    ['and', '&', '&'],
    ['practice_sessions_by', 'practice sessions by', 'sessões de prática por'],
    ['with_visit_of', 'with the visit of', 'com a visita de'],
    ['with_guest', 'with', 'com'],
  ])('should label %s in both languages', (key, enLabel, ptLabel) => {
    expect(guestIntroLabel(key, tEn)).toBe(enLabel);
    expect(guestIntroLabel(key, tPt)).toBe(ptLabel);
  });
});
