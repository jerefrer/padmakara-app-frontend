import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface SpreadIconProps {
  size?: number;
  color?: string;
}

/**
 * Two-page spread layout indicator: two page-shaped figures (with the
 * familiar dog-eared top-right corner) side by side. The corner fold is
 * what makes each shape read as "a page" rather than an abstract block,
 * matching the look of Ionicons' document-outline used for the single-
 * page mode.
 */
export function SpreadIcon({ size = 24, color = '#374151' }: SpreadIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Left page */}
      <Path
        d="M3 5 H8.5 L11 7.5 V19 H3 Z"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <Path
        d="M8.5 5 V7.5 H11"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* Right page */}
      <Path
        d="M13 5 H18.5 L21 7.5 V19 H13 Z"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <Path
        d="M18.5 5 V7.5 H21"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </Svg>
  );
}
