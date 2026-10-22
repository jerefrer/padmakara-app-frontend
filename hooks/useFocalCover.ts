import { useCallback, useMemo, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import type { ImageLoadEventData } from 'expo-image';
import { focalCoverPosition } from '@/utils/focalCover';

interface Options {
  focalX: number;
  focalY: number;
  /**
   * Use this height instead of the measured one. For collapsing heroes whose
   * container shrinks on scroll: the focal point stays computed for the full frame.
   */
  frameHeight?: number;
}

/**
 * Spread onto an expo-image drawn with contentFit="cover": keeps the focal point
 * centred in the frame. Until both the frame and the image size are known, it
 * falls back to plain object-position at the focal percentages.
 */
export function useFocalCover({ focalX, focalY, frameHeight }: Options) {
  const [frame, setFrame] = useState<{ width: number; height: number } | null>(null);
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setFrame((prev) => (prev && prev.width === width && prev.height === height ? prev : { width, height }));
  }, []);

  const onLoad = useCallback((e: ImageLoadEventData) => {
    const { width, height } = e.source;
    setNatural((prev) => (prev && prev.width === width && prev.height === height ? prev : { width, height }));
  }, []);

  const contentPosition = useMemo(() => {
    const fallback = { left: `${focalX}%`, top: `${focalY}%` } as const;
    const height = frameHeight ?? frame?.height;
    if (!frame || !natural || !height) return fallback;
    return focalCoverPosition({
      frameWidth: frame.width,
      frameHeight: height,
      imageWidth: natural.width,
      imageHeight: natural.height,
      focalX,
      focalY,
    });
  }, [frame, natural, frameHeight, focalX, focalY]);

  return { onLayout, onLoad, contentPosition };
}
