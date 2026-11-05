import en from '../../locales/en.json';
import pt from '../../locales/pt.json';

describe('Personal Library wording', () => {
  it('should name the section Personal Library in English', () => {
    expect(en.home.retreats).toBe('Personal Library');
    expect(en.home.retreatsSubtitle).toBe('Your audio, videos and transcriptions (registration required)');
    expect(en.navigation.retreats).toBe('Personal Library');
    expect(en.events.retreats).toBe('Personal Library');
  });

  it('should name the section Mediateca Pessoal in Portuguese', () => {
    expect(pt.home.retreats).toBe('Mediateca Pessoal');
    expect(pt.home.retreatsSubtitle).toBe('Os teus áudios, vídeos e transcrições (requer inscrição)');
    expect(pt.navigation.retreats).toBe('Mediateca Pessoal');
    expect(pt.events.retreats).toBe('Mediateca Pessoal');
  });
});
