import { RetreatGroup, Gathering, Session, Track, User } from '@/types';

// Mock user data
export const mockUser: User = {
  id: '1',
  name: 'João Silva',
  email: 'joao@example.com',
  retreatGroups: ['group-1'],
  preferences: {
    language: 'pt',
    contentLanguage: 'en-pt',
    biometricEnabled: true,
  },
};

// Create tracks from the sample data structure
function createTracks(basePath: string, fileList: string[], isEnglishPortuguese = false): Track[] {
  const tracks: Track[] = [];
  let order = 1;
  
  // Process English files
  const englishFiles = fileList.filter(file => 
    file.includes('JKR -') && file.endsWith('.mp3')
  ).sort();
  
  englishFiles.forEach(file => {
    const fileName = file.replace('.mp3', '');
    const parts = fileName.split(' - ');
    const trackNumber = parts[0].replace('JKR', '').trim();
    const title = parts.slice(1).join(' - ');
    
    tracks.push({
      id: `track-${order}`,
      title: title || fileName,
      duration: Math.floor(Math.random() * 3600) + 600, // Random duration between 10-70 minutes
      audioUrl: `${basePath}/${file}`,
      transcriptUrl: '', // Will be added when we have transcripts
      order: order++,
    });
  });
  
  // If it's English+Portuguese version, add Portuguese translations
  if (isEnglishPortuguese) {
    const portugueseFiles = fileList.filter(file => 
      file.includes('TRAD -') && file.endsWith('.mp3')
    ).sort();
    
    portugueseFiles.forEach(file => {
      const fileName = file.replace('.mp3', '');
      const parts = fileName.split(' - ');
      const trackNumber = parts[0].replace('TRAD', '').trim();
      const title = parts.slice(1).join(' - ');
      
      tracks.push({
        id: `track-pt-${order}`,
        title: title || fileName,
        duration: Math.floor(Math.random() * 3600) + 600,
        audioUrl: `${basePath}/${file}`,
        transcriptUrl: '',
        order: order++,
      });
    });
  }
  
  return tracks;
}

// Mind Training 2 - October 2023 (English Only)
const mindTraining2Oct2023Tracks = [
  '001 JKR - The daily practice in three parts and the Treasury of blessings.mp3',
  '002 JKR - About the Buddha\'s qualities.mp3',
  '003 JKR - About Bodhicitta and mind training.mp3',
  '004 JKR - What training the mind means.mp3',
  '005 JKR - Having and not having control.mp3',
  '006 JKR - The life of Gyalse Thogme.mp3',
  '007 JKR - Motivation - stanza 1.mp3',
  '008 JKR - Stanza 1 - what is precious.mp3',
  '009 JKR - Stanza 2 to 4.mp3',
  '010 JKR - Stanza 5 to 11.mp3',
  // ... continuing with more tracks
];

// Mind Training 2 - April 2024 (English Only)
const mindTraining2Apr2024Tracks = [
  '001 JKR+TRAD - Initial prayers-(11 April AM_part_1).mp3',
  '002 JKR - Awake from a dream-(11 April AM_part_1).mp3',
  '003 JKR - No nothingness no somethingness-(11 April AM_part_1).mp3',
  '004 JKR - Notion of I-(11 April AM_part_1).mp3',
  '005 JKR - Practice of generosity-(11 April AM_part_1).mp3',
  // ... continuing with more tracks
];

export const mockRetreatGroups: RetreatGroup[] = [
  {
    id: 'group-1',
    name: 'Mind Training Retreats',
    description: 'Jigme Khyentse Rinpoche teachings on mind training and the 37 practices of bodhisattvas',
    members: ['1'],
    gatherings: [
      {
        id: 'gathering-1',
        name: 'Mind Training 2',
        season: 'fall',
        year: 2023,
        startDate: '2023-10-26',
        endDate: '2023-10-27',
        sessions: [
          {
            id: 'session-1',
            name: 'Day 1 - Morning Session',
            type: 'morning',
            date: '2023-10-26',
            tracks: createTracks('/samples/2023-10-26_27-MIND TRAINING 2 [ENG]', mindTraining2Oct2023Tracks.slice(0, 12)),
          },
          {
            id: 'session-2',
            name: 'Day 1 - Evening Session',
            type: 'evening',
            date: '2023-10-26',
            tracks: createTracks('/samples/2023-10-26_27-MIND TRAINING 2 [ENG]', mindTraining2Oct2023Tracks.slice(12, 24)),
          },
          {
            id: 'session-3',
            name: 'Day 2 - Morning Session',
            type: 'morning',
            date: '2023-10-27',
            tracks: createTracks('/samples/2023-10-26_27-MIND TRAINING 2 [ENG]', mindTraining2Oct2023Tracks.slice(24, 36)),
          },
          {
            id: 'session-4',
            name: 'Day 2 - Evening Session',
            type: 'evening',
            date: '2023-10-27',
            tracks: createTracks('/samples/2023-10-26_27-MIND TRAINING 2 [ENG]', mindTraining2Oct2023Tracks.slice(36, 62)),
          },
        ],
      },
      {
        id: 'gathering-2',
        name: 'Mind Training 2',
        season: 'spring',
        year: 2024,
        startDate: '2024-04-11',
        endDate: '2024-04-12',
        sessions: [
          {
            id: 'session-5',
            name: 'Day 1 - Morning Session Part 1',
            type: 'morning',
            date: '2024-04-11',
            tracks: createTracks('/samples/2024-04-11_12-JKR-Mind_Training_2 [ENG]', mindTraining2Apr2024Tracks.slice(0, 12)),
          },
          {
            id: 'session-6',
            name: 'Day 1 - Morning Session Part 2',
            type: 'morning',
            date: '2024-04-11',
            tracks: createTracks('/samples/2024-04-11_12-JKR-Mind_Training_2 [ENG]', mindTraining2Apr2024Tracks.slice(12, 20)),
          },
          {
            id: 'session-7',
            name: 'Day 1 - Evening Session',
            type: 'evening',
            date: '2024-04-11',
            tracks: createTracks('/samples/2024-04-11_12-JKR-Mind_Training_2 [ENG]', mindTraining2Apr2024Tracks.slice(20, 33)),
          },
          {
            id: 'session-8',
            name: 'Day 2 - Morning & Evening Sessions',
            type: 'morning',
            date: '2024-04-12',
            tracks: createTracks('/samples/2024-04-11_12-JKR-Mind_Training_2 [ENG]', mindTraining2Apr2024Tracks.slice(33)),
          },
        ],
      },
    ],
  },
];

// Mock progress data
export const mockProgress = [
  {
    trackId: 'track-1',
    position: 1450, // 24 minutes 10 seconds
    completed: false,
    lastPlayed: '2024-01-15T14:30:00Z',
    bookmarks: [],
  },
  {
    trackId: 'track-3',
    position: 0,
    completed: true,
    lastPlayed: '2024-01-10T09:15:00Z',
    bookmarks: [],
  },
];