import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface FitHeightIconProps {
  size?: number;
  color?: string;
}

/**
 * Fit-height indicator: a page outline (with the standard dog-eared
 * corner) containing a vertical double-arrow — the page is being
 * fitted to the viewport's height, so the arrows point up and down.
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
      <Path d="M4 4 H14 L19 9 V20 H4 Z" {...stroke} />
      <Path d="M14 4 V9 H19" {...stroke} />
      {/* Vertical double-arrow inside the page */}
      <Path d="M11 11 V18" {...stroke} />
      <Path d="M9 13 L11 11 L13 13" {...stroke} />
      <Path d="M9 16 L11 18 L13 16" {...stroke} />
    </Svg>
  );
}
