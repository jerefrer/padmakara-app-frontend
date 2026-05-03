import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import type { PrefetchTarget } from '@/services/imagePrefetch';

/**
 * Mounts every (uri, cacheKey) pair as a hidden 1×1 expo-image. expo-image
 * keeps the decoded bitmap in its memory cache while the component is
 * mounted; rendering this once at the root of the app means screens that
 * request the same cacheKey display the photo instantly instead of going
 * through the disk-async grey-placeholder flash.
 *
 * This is the workaround for expo-image 3.x's `Image.prefetch()` ignoring
 * cacheKey — the only way to populate the cacheKey-keyed cache from
 * outside a screen is to actually render an <Image> with that key.
 */
export function ImagePrewarmer({ targets }: { targets: PrefetchTarget[] }) {
  if (targets.length === 0) return null;
  return (
    <View style={styles.invisible} pointerEvents="none" accessibilityElementsHidden>
      {targets.map((t) => (
        <Image
          key={t.cacheKey}
          source={{ uri: t.uri }}
          cacheKey={t.cacheKey}
          cachePolicy="memory-disk"
          style={styles.pixel}
          contentFit="cover"
          transition={0}
          recyclingKey={t.cacheKey}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  invisible: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
    overflow: 'hidden',
    top: -1,
    left: -1,
  },
  pixel: { width: 1, height: 1 },
});
