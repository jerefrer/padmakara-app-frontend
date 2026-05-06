import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface FitWidthIconProps {
  size?: number;
  color?: string;
}

/**
 * Fit-width indicator: a single page outline (same 14×18 proportion as
 * document-outline) with a horizontal double-arrow inside — the page
 * is being stretched across the viewport's width.
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
      <Path d="M5 3 H15 L19 7 V21 H5 Z" {...stroke} />
      <Path d="M15 3 V7 H19" {...stroke} />
      {/* Horizontal double-arrow */}
      <Path d="M8 13 H16" {...stroke} />
      <Path d="M10 11 L8 13 L10 15" {...stroke} />
      <Path d="M14 11 L16 13 L14 15" {...stroke} />
    </Svg>
  );
}
