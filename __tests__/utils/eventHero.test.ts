import { pickEventHero, pickPhotoTeacher } from '@/utils/heroVariant';

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

  it('should show the hero of the first teacher who has one when the first teacher has none', () => {
    const noPhoto = { id: 408, heroUrl: null };
    const pick = pickEventHero({ teachers: [noPhoto, { id: 407, ...teacher }], retreat_group: group }, false);
    expect(pick.owner).toBe('teacher');
    expect(pick.record).toMatchObject({ id: 407, heroFocalX: 10 });
    expect(pick.url).toBe('https://img/teacher.webp');
  });

  it('should follow the photoTeacherId chosen by the API', () => {
    const a = { id: 1, ...teacher };
    const b = { id: 2, heroUrl: 'https://img/b.webp' };
    expect(pickEventHero({ teachers: [a, b], photoTeacherId: 2, retreat_group: null }, false).url).toBe('https://img/b.webp');
  });
});

describe('pickPhotoTeacher', () => {
  it('should prefer a later hero over an earlier avatar-only teacher', () => {
    const list = [{ id: 1, avatarUrl: 'a' }, { id: 2, heroUrl: 'h' }];
    expect(pickPhotoTeacher(list)?.id).toBe(2);
  });

  it('should fall back to the first avatar teacher, then to null', () => {
    expect(pickPhotoTeacher([{ id: 1 }, { id: 2, avatarUrl: 'a' }])?.id).toBe(2);
    expect(pickPhotoTeacher([{ id: 1 }])).toBeNull();
  });

  it('should ignore an unknown photoTeacherId and choose locally', () => {
    expect(pickPhotoTeacher([{ id: 1, heroUrl: 'h' }], 99)?.id).toBe(1);
  });
});
