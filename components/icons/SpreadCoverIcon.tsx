import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface SpreadCoverIconProps {
  size?: number;
  color?: string;
}

/**
 * Two-page view with cover: a smaller solo cover page on the left, then
 * a normal two-page spread on the right. Each rectangle keeps the same
 * dog-eared corner as the single-page and spread icons so the toolbar
 * group reads as one family. ViewBox is wider (32×24) to give the three
 * page silhouettes room to breathe; the consumer scales by height.
 */
export function SpreadCoverIcon({ size = 24, color = '#374151' }: SpreadCoverIconProps) {
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
      {/* Cover (solo, slightly smaller) */}
      <Path d="M2 6 H6 L8 8 V18 H2 Z" {...stroke} />
      <Path d="M6 6 V8 H8" {...stroke} />
      {/* Spread — left half */}
      <Path d="M12 4 H17 L21 8 V20 H12 Z" {...stroke} />
      <Path d="M17 4 V8 H21" {...stroke} />
      {/* Spread — right half */}
      <Path d="M22 4 H27 L31 8 V20 H22 Z" {...stroke} />
      <Path d="M27 4 V8 H31" {...stroke} />
    </Svg>
  );
}
