import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface RotateRightThinIconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export function RotateRightThinIcon({ 
  size = 24, 
  color = '#374151',
  strokeWidth = 1.5
}: RotateRightThinIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 640 640" fill="none">
      {/* Rotate right icon - unfinished circle with arrow head */}
      <Path
        d="M322.9,559c63.8,0,123.8-24.9,169-70,12.4-12.3,23.4-26,32.7-40.9h0c2.2-3.5,2.9-7.5,2-11.4s-3.2-7.3-6.6-9.4c-2.4-1.5-5.2-2.3-8-2.3-5.2,0-9.9,2.6-12.7,7-8.2,12.9-17.8,25-28.7,35.9-39.5,39.5-92,61.2-147.8,61.2s-108.3-21.7-147.8-61.2-61.2-92-61.2-147.8,21.7-108.3,61.2-147.8,91.9-61.2,147.8-61.2,91.8,15.6,128.2,43.9l15.2,11.8-27.3,27.3c-2,2-2.6,5-1.5,7.7,1.1,2.6,3.6,4.3,6.5,4.3l95.1,17c3.9,0,7-3.1,7-7l-18.1-94c0-2.9-1.7-5.4-4.3-6.5-.9-.4-1.8-.5-2.7-.5-1.9,0-3.7.7-5.1,2.1l-28.6,28.7-11.9-9.9c-42.7-35.4-96.8-54.9-152.4-54.9s-123.9,24.9-169,70c-45.2,45.2-70,105.2-70,169s24.9,123.8,70,169c45.2,45.2,105.2,70,169,70h0Z"
        fill={color}
        stroke="none"
      />
    </Svg>
  );
}