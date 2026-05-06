import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface SinglePageIconProps {
  size?: number;
  color?: string;
}

/**
 * Single-page indicator for the PDF viewer toolbar — same 14×18 page
 * silhouette and dog-eared corner used by the spread / spread-cover /
 * fit-width / fit-height icons, drawn here on its own so the whole
 * group reads as one family.
 */
export function SinglePageIcon({ size = 24, color = '#374151' }: SinglePageIconProps) {
  const stroke = {
    stroke: color,
    strokeWidth: 1.5,
    strokeLinejoin: 'round' as const,
    strokeLinecap: 'round' as const,
  };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M5 3 H15 L19 7 V21 H5 Z" {...stroke} />
      <Path d="M15 3 V7 H19" {...stroke} />
    </Svg>
  );
}
