import { compareTitles, titleSortKey } from './titleSort';

describe('titleSortKey', () => {
  it('should drop a leading Portuguese article when sorting', () => {
    expect(titleSortKey('O Tesouro de Bênçãos')).toBe('Tesouro de Bênçãos');
    expect(titleSortKey('Os Cinco Agregados')).toBe('Cinco Agregados');
    expect(titleSortKey('A Roda do Darma')).toBe('Roda do Darma');
    expect(titleSortKey('As Trinta e Sete Práticas')).toBe('Trinta e Sete Práticas');
    expect(titleSortKey('Um Caminho')).toBe('Caminho');
    expect(titleSortKey('Uma Prece')).toBe('Prece');
    expect(titleSortKey('Uns Versos')).toBe('Versos');
    expect(titleSortKey('Umas Palavras')).toBe('Palavras');
  });

  it('should drop a leading English article when sorting', () => {
    expect(titleSortKey('The Words of My Perfect Teacher')).toBe('Words of My Perfect Teacher');
    expect(titleSortKey('An Ocean of Blessings')).toBe('Ocean of Blessings');
  });

  it('should ignore the case of the article', () => {
    expect(titleSortKey('the heart sutra')).toBe('heart sutra');
    expect(titleSortKey('OS CINCO')).toBe('CINCO');
  });

  it('should keep a word that only starts like an article', () => {
    expect(titleSortKey('Oração')).toBe('Oração');
    expect(titleSortKey('Theory of Mind')).toBe('Theory of Mind');
    expect(titleSortKey('Anuttarayoga')).toBe('Anuttarayoga');
    expect(titleSortKey('Asanga')).toBe('Asanga');
  });

  it('should keep an article that is the whole title', () => {
    expect(titleSortKey('A')).toBe('A');
    expect(titleSortKey('The')).toBe('The');
  });

  it('should drop leading quotes and punctuation before the article', () => {
    expect(titleSortKey('« O Tesouro »')).toBe('Tesouro »');
    expect(titleSortKey('"The Jewel Ornament"')).toBe('Jewel Ornament"');
    expect(titleSortKey('…Infinita Vida')).toBe('Infinita Vida');
  });

  it('should drop only one article', () => {
    expect(titleSortKey('A A Bodhisattva')).toBe('A Bodhisattva');
  });
});

describe('compareTitles', () => {
  const sortTitles = (titles: string[]) => [...titles].sort(compareTitles);

  it('should file titles under their first word after the article', () => {
    expect(
      sortTitles([
        'As Trinta e Sete Práticas dos Bodhisattvas',
        'Infinita Vida e Sabedoria',
        'O Excelente Caminho da Libertação',
        'O Tesouro de Bênçãos',
        'Os Cinco Agregados e os Cinquenta e Um Fatores Mentais Associados',
        'Roda da Meditação Analítica',
      ])
    ).toEqual([
      'Os Cinco Agregados e os Cinquenta e Um Fatores Mentais Associados',
      'O Excelente Caminho da Libertação',
      'Infinita Vida e Sabedoria',
      'Roda da Meditação Analítica',
      'O Tesouro de Bênçãos',
      'As Trinta e Sete Práticas dos Bodhisattvas',
    ]);
  });

  it('should compare without regard to accents or case', () => {
    expect(sortTitles(['Ética', 'estrela', 'Fim'])).toEqual(['estrela', 'Ética', 'Fim']);
    expect(compareTitles('Bênção', 'bencao')).toBe(0);
  });

  it('should compare numbers inside titles by value', () => {
    expect(sortTitles(['Volume 10', 'Volume 2'])).toEqual(['Volume 2', 'Volume 10']);
  });
});
