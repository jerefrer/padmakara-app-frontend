import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface FitWidthIconProps {
  size?: number;
  color?: string;
}

/**
 * Fit-width indicator: a page outline (with the standard dog-eared
 * corner) containing a horizontal double-arrow — the page is being
 * fitted across the viewport's width, so the arrows point sideways.
 */
export function FitWidthIcon({ size = 24, color = '#374151' }: FitWidthIconProps) {
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
      {/* Horizontal double-arrow inside the page */}
      <Path d="M7 14 H16" {...stroke} />
      <Path d="M9 12 L7 14 L9 16" {...stroke} />
      <Path d="M14 12 L16 14 L14 16" {...stroke} />
    </Svg>
  );
}
