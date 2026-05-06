import React from 'react';
import Svg, { Rect } from 'react-native-svg';

interface SpreadIconProps {
  size?: number;
  color?: string;
}

/**
 * Two-page spread layout indicator: two identical pages side by side.
 * Used in the PDF viewer toolbar to switch to "two pages" view.
 */
export function SpreadIcon({ size = 24, color = '#374151' }: SpreadIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect
        x="3"
        y="4"
        width="8"
        height="16"
        rx="1"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <Rect
        x="13"
        y="4"
        width="8"
        height="16"
        rx="1"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
    </Svg>
  );
}
