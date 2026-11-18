import React from 'react';
import { render } from '@testing-library/react-native';
import { TranscriptTags } from './TranscriptTags';

jest.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) => key,
  }),
}));

describe('TranscriptTags', () => {
  it('should render nothing for a final, full transcript', () => {
    const { toJSON } = render(<TranscriptTags status="final" isExcerpt={false} />);
    expect(toJSON()).toBeNull();
  });

  it('should render the status tag of a provisional transcript', () => {
    const { getByText } = render(<TranscriptTags status="provisional" />);
    expect(getByText('documents.transcriptStatus.provisional')).toBeTruthy();
  });

  it('should render both the unrevised and the excerpts tags', () => {
    const { getByText } = render(<TranscriptTags status="unrevised" isExcerpt />);
    expect(getByText('documents.transcriptStatus.unrevised')).toBeTruthy();
    expect(getByText('documents.transcriptExcerpts')).toBeTruthy();
  });

  it('should render the draft tag', () => {
    const { getByText } = render(<TranscriptTags status="draft" />);
    expect(getByText('documents.transcriptStatus.draft')).toBeTruthy();
  });
});
