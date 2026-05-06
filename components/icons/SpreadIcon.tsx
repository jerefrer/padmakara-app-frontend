import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface SpreadIconProps {
  size?: number;
  color?: string;
}

/**
 * Two-page view: two pages side by side, each kept at the same 14×18
 * proportion as Ionicons' document-outline so the whole toolbar group
 * (single, spread, spread-cover) reads as one family. The viewBox is
 * widened to 32×24 to fit two full-size pages without cramping.
 */
export function SpreadIcon({ size = 24, color = '#374151' }: SpreadIconProps) {
  const stroke = {
    stroke: color,
    strokeWidth: 1.5,
    strokeLinejoin: 'round' as const,
    strokeLinecap: 'round' as const,
  };
  return (
    <Svg
      width={(size * 32) / 24}
      height={size}
      viewBox="0 0 32 24"
      fill="none"
    >
      {/* Left page */}
      <Path d="M1 3 H11 L15 7 V21 H1 Z" {...stroke} />
      <Path d="M11 3 V7 H15" {...stroke} />
      {/* Right page */}
      <Path d="M17 3 H27 L31 7 V21 H17 Z" {...stroke} />
      <Path d="M27 3 V7 H31" {...stroke} />
    </Svg>
  );
}
