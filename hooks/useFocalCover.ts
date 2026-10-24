import { useCallback, useMemo, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import type { ImageLoadEventData } from 'expo-image';
import { focalCoverPosition, focalCoverTransform } from '@/utils/focalCover';
import type { HeroFrameOverride } from '@/utils/heroFrames';

interface Options {
  focalX: number;
  focalY: number;
  /**
   * Use this height instead of the measured one. For collapsing heroes whose
   * container shrinks on scroll: the focal point stays computed for the full frame.
   */
  frameHeight?: number;
  /**
   * This layout's own framing from the admin (pickFrameOverride). Replaces the hero's focal point
   * and adds a zoom; null/undefined = follow focalX/focalY.
   */
  override?: HeroFrameOverride | null;
}

/**
 * Spread onto an expo-image drawn with contentFit="cover": keeps the focal point
 * centred in the frame. Until both the frame and the image size are known, it
 * falls back to plain object-position at the focal percentages.
 */
export function useFocalCover({ focalX: heroFocalX, focalY: heroFocalY, frameHeight, override }: Options) {
  const focalX = override?.focalX ?? heroFocalX;
  const focalY = override?.focalY ?? heroFocalY;
  const zoom = override?.zoom ?? 1;
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
    // Zoomed frames are placed by a transform around a centred cover image (see zoomStyle).
    if (zoom > 1) return { left: '50%', top: '50%' } as const;
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
  }, [frame, natural, frameHeight, focalX, focalY, zoom]);

  // Spread into the image style when the frame is zoomed. The container must clip (overflow: hidden).
  const zoomStyle = useMemo(() => {
    const height = frameHeight ?? frame?.height;
    if (zoom <= 1 || !frame || !natural || !height) return undefined;
    const { scale, translateX, translateY } = focalCoverTransform({
      frameWidth: frame.width,
      frameHeight: height,
      imageWidth: natural.width,
      imageHeight: natural.height,
      focalX,
      focalY,
      zoom,
    });
    return { transform: [{ translateX }, { translateY }, { scale }] };
  }, [frame, natural, frameHeight, focalX, focalY, zoom]);

  return { onLayout, onLoad, contentPosition, zoomStyle, hasOverride: !!override };
}
