import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface SpreadCoverIconProps {
  size?: number;
  color?: string;
}

/**
 * Two-page view with cover: the cover sits on the left as a blank page,
 * and the second page on the right shows text lines — Acrobat's
 * convention for "show cover page" is a blank cover next to a content
 * page so the difference between the two layouts is obvious at a glance.
 *
 * Both pages share the 14×18 proportion of document-outline so the
 * whole layout group looks consistent.
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
      {/* Cover (blank, on the left) */}
      <Path d="M1 3 H11 L15 7 V21 H1 Z" {...stroke} />
      <Path d="M11 3 V7 H15" {...stroke} />
      {/* Content page (right) — same outline as the cover, plus text
          lines hinting at the page's content. */}
      <Path d="M17 3 H27 L31 7 V21 H17 Z" {...stroke} />
      <Path d="M27 3 V7 H31" {...stroke} />
      <Path d="M19 12 H29" {...stroke} />
      <Path d="M19 15 H29" {...stroke} />
      <Path d="M19 18 H26" {...stroke} />
    </Svg>
  );
}
