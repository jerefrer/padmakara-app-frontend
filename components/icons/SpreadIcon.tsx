import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface SpreadIconProps {
  size?: number;
  color?: string;
}

/**
 * Two-page view: two pages side by side, each with a prominent
 * dog-eared top-right corner — same visual language as the
 * document-outline icon used for the single-page mode, just doubled up.
 */
export function SpreadIcon({ size = 24, color = '#374151' }: SpreadIconProps) {
  const stroke = {
    stroke: color,
    strokeWidth: 1.5,
    strokeLinejoin: 'round' as const,
    strokeLinecap: 'round' as const,
  };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Left page */}
      <Path d="M2 4 H7 L11 8 V20 H2 Z" {...stroke} />
      <Path d="M7 4 V8 H11" {...stroke} />
      {/* Right page */}
      <Path d="M13 4 H18 L22 8 V20 H13 Z" {...stroke} />
      <Path d="M18 4 V8 H22" {...stroke} />
    </Svg>
  );
}
