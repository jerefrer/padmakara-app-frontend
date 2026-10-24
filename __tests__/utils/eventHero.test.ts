import { pickEventHero } from '@/utils/heroVariant';

const teacher = { heroUrl: 'https://img/teacher.webp', heroFocalX: 10, heroFocalY: 20, heroScale: 120 };
const group = { heroUrl: 'https://img/group.webp', heroFocalX: 70, heroFocalY: 80, heroScale: 100 };

describe('pickEventHero', () => {
  it('should prefer the first teacher hero when both teacher and group have one', () => {
    const pick = pickEventHero({ teachers: [teacher], retreat_group: group }, false);
    expect(pick.owner).toBe('teacher');
    expect(pick.record).toBe(teacher);
    expect(pick.url).toBe('https://img/teacher.webp');
  });

  it('should fall back to the group hero when the teacher has no hero', () => {
    const pick = pickEventHero({ teachers: [{ heroUrl: null }], retreat_group: group }, false);
    expect(pick.owner).toBe('group');
    expect(pick.record).toBe(group);
    expect(pick.url).toBe('https://img/group.webp');
  });

  it('should return no hero when neither has one', () => {
    const pick = pickEventHero({ teachers: [], retreat_group: null }, true);
    expect(pick.url).toBeNull();
    expect(pick.owner).toBeNull();
  });

  it('should use the mobile variant of the chosen teacher on phones', () => {
    const pick = pickEventHero(
      { teachers: [{ ...teacher, heroMobileUrl: 'https://img/teacher-m.webp' }], retreat_group: group },
      true,
    );
    expect(pick.url).toBe('https://img/teacher-m.webp');
    expect(pick.variant).toBe('mobile');
  });

  it('should hand back the frame overrides of the record that owns the image', () => {
    const teacherOverrides = { page: { focalX: 30, focalY: 40, zoom: 2 } };
    const groupOverrides = { page: { focalX: 60, focalY: 10, zoom: 1.5 } };
    const t = { ...teacher, heroFrameOverrides: teacherOverrides };
    const g = { ...group, heroFrameOverrides: groupOverrides };
    expect(pickEventHero({ teachers: [t], retreat_group: g }, false).record?.heroFrameOverrides).toBe(teacherOverrides);
    expect(pickEventHero({ teachers: [{ heroUrl: null }], retreat_group: g }, false).record?.heroFrameOverrides).toBe(groupOverrides);
  });
});
