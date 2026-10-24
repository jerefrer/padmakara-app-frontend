import React from 'react';
import { render } from '@testing-library/react-native';

import { WatermarkNotice } from '@/components/WatermarkNotice';
import en from '@/locales/en.json';
import pt from '@/locales/pt.json';

let mockLocale: any = en;
jest.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) => key.split('.').reduce((node: any, part) => node?.[part], mockLocale),
  }),
}));

describe('WatermarkNotice', () => {
  it('should explain that a personal copy is being watermarked, in English', () => {
    mockLocale = en;
    const { getByText } = render(<WatermarkNotice />);
    expect(
      getByText('Your personal copy is being generated and watermarked with your name and email.'),
    ).toBeTruthy();
  });

  it('should show the same message in Portuguese when floating', () => {
    mockLocale = pt;
    const { getByText, getByTestId } = render(<WatermarkNotice floating />);
    expect(
      getByText('A sua cópia pessoal está a ser gerada, com uma marca de água com o seu nome e email.'),
    ).toBeTruthy();
    expect(getByTestId('watermark-notice')).toBeTruthy();
  });
});
