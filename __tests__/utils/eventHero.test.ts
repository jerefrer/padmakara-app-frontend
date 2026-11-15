import { pickEventHero, pickEventPhoto, pickPhotoTeacher, pickThumbTeacher } from '@/utils/heroVariant';

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

describe('pickThumbTeacher', () => {
  it('should show the teacher the event page shows, not the first one listed', () => {
    const teachers = [
      { id: 1, avatarUrl: 'a1' },
      { id: 2, avatarUrl: 'a2', heroUrl: 'h2' },
    ];

    expect(pickThumbTeacher(teachers, null)?.id).toBe(2);
  });

  it('should follow the API photoTeacherId', () => {
    const teachers = [{ id: 1, avatarUrl: 'a1', heroUrl: 'h1' }, { id: 2, avatarUrl: 'a2' }];

    expect(pickThumbTeacher(teachers, 2)?.id).toBe(2);
  });

  it('should fall back to a teacher with an avatar when the photo teacher has none', () => {
    const teachers = [{ id: 1, heroUrl: 'h1' }, { id: 2, avatarUrl: 'a2' }];

    expect(pickThumbTeacher(teachers, 1)?.id).toBe(2);
  });

  it('should return the first teacher when nobody has a picture', () => {
    expect(pickThumbTeacher([{ id: 1 }, { id: 2 }], null)?.id).toBe(1);
  });
});

describe('event photo', () => {
  const photo = {
    avatarUrl: 'https://img/event-avatar.webp',
    heroUrl: 'https://img/event.webp',
    heroMobileUrl: 'https://img/event-m.webp',
    heroFocalX: 35,
    heroFocalY: 65,
    heroScale: 100,
    heroFrameOverrides: { page: { focalX: 5, focalY: 6, zoom: 2 } },
  };

  it('should win over the teachers and the group when the event has a photo', () => {
    const pick = pickEventHero({ image: photo, teachers: [teacher], retreat_group: group }, false);
    expect(pick.owner).toBe('event');
    expect(pick.url).toBe('https://img/event.webp');
  });

  it('should use the mobile variant of the event photo on phones', () => {
    const pick = pickEventHero({ image: photo, teachers: [teacher] }, true);
    expect(pick.url).toBe('https://img/event-m.webp');
    expect(pick.variant).toBe('mobile');
  });

  it('should hand back the focal point and frame overrides of the event photo itself', () => {
    const pick = pickEventHero({ image: photo, teachers: [teacher], retreat_group: group }, false);
    expect(pick.record).toBe(photo);
    expect(pick.record?.heroFocalX).toBe(35);
    expect(pick.record?.heroFrameOverrides).toBe(photo.heroFrameOverrides);
  });

  it('should fall back to the teacher when the event has no photo', () => {
    expect(pickEventHero({ image: null, teachers: [teacher], retreat_group: group }, false).owner).toBe('teacher');
    expect(pickEventHero({ teachers: [teacher], retreat_group: group }, false).owner).toBe('teacher');
  });

  it('should fall back to the group when the event has no photo and the teacher has no hero', () => {
    expect(pickEventHero({ image: null, teachers: [{ heroUrl: null }], retreat_group: group }, false).owner).toBe('group');
  });

  it('should fall back to the teacher when the photo has only an avatar', () => {
    const avatarOnly = { avatarUrl: 'https://img/a.webp' };
    expect(pickEventHero({ image: avatarOnly, teachers: [teacher] }, false).owner).toBe('teacher');
  });

  it('should fall back to the teacher when the photo has no usable picture', () => {
    expect(pickEventHero({ image: { heroUrl: null, heroMobileUrl: null }, teachers: [teacher] }, false).owner).toBe('teacher');
  });

  describe('pickEventPhoto', () => {
    it('should return the photo when it has any picture', () => {
      expect(pickEventPhoto({ image: photo })).toBe(photo);
      expect(pickEventPhoto({ image: { avatarUrl: 'a' } })).toEqual({ avatarUrl: 'a' });
    });

    it('should return null without a photo or picture', () => {
      expect(pickEventPhoto({ image: null })).toBeNull();
      expect(pickEventPhoto({})).toBeNull();
      expect(pickEventPhoto(undefined)).toBeNull();
      expect(pickEventPhoto({ image: { heroUrl: null } })).toBeNull();
    });
  });
});
