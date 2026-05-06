import React from 'react';
import Svg, { Rect } from 'react-native-svg';

interface SpreadCoverIconProps {
  size?: number;
  color?: string;
}

/**
 * Two-page-with-cover layout indicator: one solo cover page on the left,
 * a small gap, then two paired pages — mirroring how a real book is read
 * (cover alone, then opens to spreads).
 */
export function SpreadCoverIcon({ size = 24, color = '#374151' }: SpreadCoverIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Cover page (alone) */}
      <Rect
        x="2"
        y="6"
        width="5"
        height="12"
        rx="1"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      {/* Spread pair */}
      <Rect
        x="9.5"
        y="6"
        width="6"
        height="12"
        rx="1"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <Rect
        x="16"
        y="6"
        width="6"
        height="12"
        rx="1"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
    </Svg>
  );
}
