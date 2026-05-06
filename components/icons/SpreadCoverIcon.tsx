import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface SpreadCoverIconProps {
  size?: number;
  color?: string;
}

/**
 * Two-page-with-cover layout indicator: a solo cover page on the left
 * (slightly smaller, like a real book cover thinner than the inside
 * pages), a small gap, then two paired pages — each with the standard
 * dog-eared corner so they read as pages, matching the single-page icon
 * style.
 *
 * Wider viewBox (32×24) than the spread variant so three folded pages
 * fit comfortably; the rendered button is still visually balanced because
 * the consumer scales by the height prop.
 */
export function SpreadCoverIcon({ size = 24, color = '#374151' }: SpreadCoverIconProps) {
  const stroke = {
    stroke: color,
    strokeWidth: 1.5,
    strokeLinejoin: 'round' as const,
    strokeLinecap: 'round' as const,
  };
  return (
    <Svg width={(size * 32) / 24} height={size} viewBox="0 0 32 24" fill="none">
      {/* Cover (solo) */}
      <Path d="M2.5 6 H7 L9 8 V18 H2.5 Z" {...stroke} />
      <Path d="M7 6 V8 H9" {...stroke} />
      {/* Spread — left half */}
      <Path d="M13 5 H18 L20 7 V19 H13 Z" {...stroke} />
      <Path d="M18 5 V7 H20" {...stroke} />
      {/* Spread — right half */}
      <Path d="M22 5 H27 L29 7 V19 H22 Z" {...stroke} />
      <Path d="M27 5 V7 H29" {...stroke} />
    </Svg>
  );
}
