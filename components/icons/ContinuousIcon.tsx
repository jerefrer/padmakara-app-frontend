import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { colors } from '@/constants/colors';

interface ContinuousIconProps {
  size?: number;
  color?: string;
}

/**
 * Continuous-scroll indicator for the PDF viewer toolbar: a column of pages,
 * the one in view whole and the next one entering from below, as in
 * Acrobat's scrolling mode. Same stroke and page width as the other page
 * icons so the mode group reads as one family.
 */
export function ContinuousIcon({ size = 24, color = colors.gray[700] }: ContinuousIconProps) {
  const stroke = {
    stroke: color,
    strokeWidth: 1.5,
    strokeLinejoin: 'round' as const,
    strokeLinecap: 'round' as const,
  };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Page in view */}
      <Path d="M5 2 H15 L19 6 V14 H5 Z" {...stroke} />
      <Path d="M15 2 V6 H19" {...stroke} />
      {/* Next page, entering from below */}
      <Path d="M5 22 V18 H19 V22" {...stroke} />
    </Svg>
  );
}
