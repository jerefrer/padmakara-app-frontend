import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface FitHeightIconProps {
  size?: number;
  color?: string;
}

/**
 * Fit-height indicator: a single page outline (same 14×18 proportion as
 * document-outline) with a vertical double-arrow inside — the page is
 * being stretched to the viewport's height.
 */
export function FitHeightIcon({ size = 24, color = '#374151' }: FitHeightIconProps) {
  const stroke = {
    stroke: color,
    strokeWidth: 1.5,
    strokeLinejoin: 'round' as const,
    strokeLinecap: 'round' as const,
  };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Page outline */}
      <Path d="M5 3 H15 L19 7 V21 H5 Z" {...stroke} />
      <Path d="M15 3 V7 H19" {...stroke} />
      {/* Vertical double-arrow */}
      <Path d="M12 9 V17" {...stroke} />
      <Path d="M10 11 L12 9 L14 11" {...stroke} />
      <Path d="M10 15 L12 17 L14 15" {...stroke} />
    </Svg>
  );
}
