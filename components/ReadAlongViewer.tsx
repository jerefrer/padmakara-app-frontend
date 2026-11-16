import { useAudioPlayerContext } from '@/contexts/AudioPlayerContext';
import { useLanguage } from '@/contexts/LanguageContext';
import readAlongService from '@/services/readAlongService';
import readAlongPreferencesService, {
  DEFAULT_TEXT_SIZE_INDEX,
  getReadAlongTextMetrics,
  nextTextSizeIndex,
} from '@/services/readAlongPreferencesService';
import { ReadAlongData, ReadAlongWord } from '@/types';
import { readingScrollTarget } from '@/utils/readAlongScroll';
import { paragraphProgress, wordOffsets, type ParaWords } from '@/utils/readAlongParagraphs';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';

const colors = {
  burgundy: {
    50: '#f8f1f1',
    100: '#f2e0e0',
    500: '#9b1b1b',
    600: '#7b1616',
  },
  gray: {
    100: '#f3f4f6',
    200: '#e5e7eb',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#2c2c2c',
  },
  white: '#ffffff',
};

interface ReadAlongViewerProps {
  /** Pre-loaded alignment data (preferred) */
  readAlongData?: ReadAlongData | null;
  /** URL to fetch alignment data from (fallback) */
  readAlongUrl?: string;
  onClose: () => void;
  /**
   * Pixels reserved at the bottom of the scroll content for an overlapping
   * audio player (mobile uses an absolutely-positioned AudioPlayer). Defaults
   * to 0 so the text scrolls flush to the bottom edge.
   */
  bottomInset?: number;
  /**
   * Hides the header (reading full screen, e.g. a phone held sideways) and
   * shows a small button that calls `onShowChrome` to bring the bars back.
   */
  chromeHidden?: boolean;
  onShowChrome?: () => void;
}

// After the reader lets go of the text, wait this long before following the
// audio again.
const USER_SCROLL_PAUSE_MS = 3000;

/**
 * Displays transcript text with word-level highlighting synced to audio playback.
 * Words are tappable to seek to that position.
 */
export function ReadAlongViewer({
  readAlongData: preloadedData,
  readAlongUrl,
  onClose,
  bottomInset = 0,
  chromeHidden = false,
  onShowChrome,
}: ReadAlongViewerProps) {
  const { t } = useLanguage();
  const { width: windowWidth } = useWindowDimensions();
  const { position, isPlaying, seekTo, player } = useAudioPlayerContext();

  // Offset (seconds) to compensate for audio pipeline latency.
  // player.currentTime reports the decode position, which is slightly
  // ahead of what actually reaches the speakers.
  const AUDIO_LATENCY_OFFSET = 0.18;

  // High-frequency position tracking via requestAnimationFrame
  // Polls player.currentTime directly, throttled to ~30fps to balance
  // smoothness vs render cost. Falls back to context position on native.
  const [rafPosition, setRafPosition] = useState(position);
  const rafRef = useRef<number | null>(null);
  const lastRafUpdateRef = useRef(0);

  useEffect(() => {
    // On web, use RAF to poll player.currentTime for smooth highlighting
    if (Platform.OS !== 'web' || !isPlaying || !player) {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }

    const tick = (timestamp: number) => {
      // Throttle to ~30fps (every ~33ms) to reduce re-renders
      if (timestamp - lastRafUpdateRef.current >= 33) {
        try {
          const currentTime = player.currentTime;
          if (typeof currentTime === 'number' && !isNaN(currentTime)) {
            setRafPosition(Math.max(0, currentTime - AUDIO_LATENCY_OFFSET));
          }
        } catch {}
        lastRafUpdateRef.current = timestamp;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isPlaying, player]);

  // Sync from context position when not using RAF (native, or when paused)
  useEffect(() => {
    if (Platform.OS !== 'web' || !isPlaying) {
      setRafPosition(position);
    }
  }, [position, isPlaying]);

  // Text size step (persisted on the device).
  const [sizeIndex, setSizeIndex] = useState(DEFAULT_TEXT_SIZE_INDEX);
  const textMetrics = useMemo(() => getReadAlongTextMetrics(sizeIndex), [sizeIndex]);

  useEffect(() => {
    let cancelled = false;
    readAlongPreferencesService
      .getTextSizeIndex()
      .then((saved) => {
        if (!cancelled) setSizeIndex(saved);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const [data, setData] = useState<ReadAlongData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const scrollViewRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const scrollYRef = useRef(0);
  const userScrollingRef = useRef(false);
  const userScrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [scrollViewHeight, setScrollViewHeight] = useState(0);

  // Where the line of the word being read sits, and the text layout it was
  // measured in. A new layout (text size, rotation, or the first measurement
  // on open) recenters at once; otherwise the text follows the audio only
  // when the line leaves the comfortable band.
  const activeWordRef = useRef<{ y: number; height: number } | null>(null);
  const measuredLayoutKeyRef = useRef<string | null>(null);
  const layoutKey = `${sizeIndex}|${windowWidth}`;
  const visibleHeight = Math.max(scrollViewHeight - bottomInset, scrollViewHeight * 0.4);
  const isPlayingRef = useRef(isPlaying);
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  const scrollToActiveWord = useCallback(
    (force: boolean, animated: boolean) => {
      const word = activeWordRef.current;
      if (!word || !scrollViewRef.current) return;
      const target = readingScrollTarget({
        wordY: word.y,
        wordHeight: word.height,
        scrollY: scrollYRef.current,
        viewportHeight: visibleHeight,
        force,
      });
      if (target !== null) scrollViewRef.current.scrollTo({ y: target, animated });
    },
    [visibleHeight],
  );

  const handleActiveWordLayout = useCallback(
    (y: number, height: number, key: string) => {
      activeWordRef.current = { y: y + styles.scrollContent.paddingTop, height };
      const newLayout = measuredLayoutKeyRef.current !== key;
      measuredLayoutKeyRef.current = key;
      if (newLayout) {
        scrollToActiveWord(true, false);
      } else if (isPlayingRef.current && !userScrollingRef.current) {
        scrollToActiveWord(false, true);
      }
    },
    [scrollToActiveWord],
  );

  // The view changed height (bars shown or hidden, rotation): put the line
  // being read back on the reading line.
  useEffect(() => {
    scrollToActiveWord(true, false);
  }, [visibleHeight, scrollToActiveWord]);

  // Pressing play again brings the text back to the word being read, even if
  // the reader had scrolled away while paused.
  useEffect(() => {
    if (!isPlaying) return;
    userScrollingRef.current = false;
    if (userScrollTimerRef.current) clearTimeout(userScrollTimerRef.current);
    scrollToActiveWord(true, true);
  }, [isPlaying, scrollToActiveWord]);

  useEffect(
    () => () => {
      if (userScrollTimerRef.current) clearTimeout(userScrollTimerRef.current);
    },
    [],
  );

  // Load alignment data (from pre-loaded data or URL)
  useEffect(() => {
    if (preloadedData) {
      setData(preloadedData);
      setLoading(false);
      setError(false);
      return;
    }

    if (!readAlongUrl) {
      setError(true);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(false);

    readAlongService
      .loadAlignment(readAlongUrl, (updated) => {
        // Background revalidation found newer data
        if (!cancelled) setData(updated);
      })
      .then((result) => {
        if (cancelled) return;
        if (result) {
          setData(result);
        } else {
          setError(true);
        }
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [preloadedData, readAlongUrl]);

  // Merge Whisper segments into visual paragraphs.
  // Segments are often just 1-2 words; rendering each as a block creates
  // ugly line breaks. Instead, merge into flowing paragraphs and only
  // break when the previous text ends with sentence-ending punctuation
  // AND there's a pause. For very long pauses (teacher changing topic),
  // break regardless to avoid wall-of-text paragraphs.
  const PARAGRAPH_GAP = 4;      // seconds — break if sentence ended
  const FORCE_BREAK_GAP = 10;   // seconds — break regardless

  interface ParaWord {
    word: ReadAlongWord;
    segIdx: number;
    wordIdx: number;
  }

  const paragraphs = useMemo(() => {
    if (!data) return [];
    const paras: ParaWord[][] = [];
    let current: ParaWord[] = [];

    data.clean_segments.forEach((seg, segIdx) => {
      if (current.length > 0) {
        const lastWord = current[current.length - 1].word;
        const gap = seg.start - lastWord.end;
        const prevText = lastWord.word.trim();
        const endsSentence = /[.!?…»]$/.test(prevText);

        if (gap > FORCE_BREAK_GAP || (gap > PARAGRAPH_GAP && endsSentence)) {
          paras.push(current);
          current = [];
        }
      }
      seg.words.forEach((w, wordIdx) => {
        current.push({ word: w, segIdx, wordIdx });
      });
    });
    if (current.length > 0) paras.push(current);
    return paras;
  }, [data]);

  // Find the current segment and word based on audio position
  // Uses rafPosition (high-frequency on web) for smooth word tracking
  const { activeSegmentIndex, activeWordIndex } = useMemo(() => {
    if (!data) return { activeSegmentIndex: -1, activeWordIndex: -1 };

    let segIdx = -1;
    let wordIdx = -1;

    // Binary search for the active segment
    const segments = data.clean_segments;
    let lo = 0;
    let hi = segments.length - 1;

    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      if (rafPosition < segments[mid].start) {
        hi = mid - 1;
      } else if (rafPosition > segments[mid].end) {
        lo = mid + 1;
      } else {
        segIdx = mid;
        break;
      }
    }

    // If between segments, pick the nearest upcoming one
    if (segIdx === -1 && lo < segments.length && lo > 0) {
      // We're in a gap — use the previous segment if close, else next
      const prev = segments[lo - 1];
      const next = segments[lo];
      if (rafPosition - prev.end < 1.0) {
        segIdx = lo - 1;
      } else if (next.start - rafPosition < 2.0) {
        segIdx = lo;
      }
    }

    // Find active word within segment
    if (segIdx >= 0) {
      const words = segments[segIdx].words;
      for (let i = 0; i < words.length; i++) {
        if (rafPosition >= words[i].start && rafPosition < words[i].end) {
          wordIdx = i;
          break;
        }
        // Handle gaps between words within a segment
        if (i < words.length - 1 && rafPosition >= words[i].end && rafPosition < words[i + 1].start) {
          wordIdx = i;
          break;
        }
      }
      // If past last word timing but within segment, highlight last word
      if (wordIdx === -1 && words.length > 0 && rafPosition >= words[words.length - 1].start) {
        wordIdx = words.length - 1;
      }
    }

    return { activeSegmentIndex: segIdx, activeWordIndex: wordIdx };
  }, [data, rafPosition]);

  // Sticky "last known active" position. The audio drops out of any
  // segment in between paragraphs (and during long pauses), which would
  // otherwise make the just-finished paragraph un-fade. By remembering
  // the last position we saw, we can keep treating earlier paragraphs
  // as past until a new active position is detected.
  const lastActiveRef = useRef({ segIdx: -1, wordIdx: -1 });
  useEffect(() => {
    if (activeSegmentIndex >= 0) {
      lastActiveRef.current = {
        segIdx: activeSegmentIndex,
        wordIdx: activeWordIndex,
      };
    }
  }, [activeSegmentIndex, activeWordIndex]);

  // The values that drive the per-paragraph fade. While active is valid we
  // pass it through. While we're in a gap (active === -1) we synthesize a
  // "we just finished segment N" position so paragraphs ending at or
  // before N stay faded as past content. activeWordIndex is set to -1 in
  // the gap so no specific word gets the live "currently playing" tint.
  const inGap = activeSegmentIndex < 0 && lastActiveRef.current.segIdx >= 0;
  const effectiveSegmentIndex = inGap
    ? lastActiveRef.current.segIdx + 1
    : activeSegmentIndex;
  const effectiveWordIndex = inGap ? -1 : activeWordIndex;

  // While the reader drags or flings the text, leave it alone; once they let
  // go, follow the audio again after a short pause.
  const handleScrollBeginDrag = useCallback(() => {
    userScrollingRef.current = true;
    if (userScrollTimerRef.current) clearTimeout(userScrollTimerRef.current);
  }, []);

  const handleScrollEnd = useCallback(() => {
    if (userScrollTimerRef.current) clearTimeout(userScrollTimerRef.current);
    userScrollTimerRef.current = setTimeout(() => {
      userScrollingRef.current = false;
      if (isPlayingRef.current) scrollToActiveWord(true, true);
    }, USER_SCROLL_PAUSE_MS);
  }, [scrollToActiveWord]);

  // Move to the next text size (wrapping after the largest). The new layout
  // key makes the active word re-measure and recenter.
  const cycleSize = useCallback(() => {
    const next = nextTextSizeIndex(sizeIndex);
    setSizeIndex(next);
    readAlongPreferencesService.setTextSizeIndex(next).catch(() => {});
  }, [sizeIndex]);

  // Tap a word to seek
  const handleWordPress = useCallback((word: ReadAlongWord) => {
    seekTo(word.start * 1000); // seekTo takes milliseconds
  }, [seekTo]);

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t('readAlong.title') || 'Read Along'}</Text>
          <TouchableOpacity onPress={onClose} style={styles.headerButton}>
            <Ionicons name="close" size={24} color={colors.gray[600]} />
          </TouchableOpacity>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.burgundy[500]} />
          <Text style={styles.loadingText}>{t('readAlong.loading') || 'Loading transcript...'}</Text>
        </View>
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t('readAlong.title') || 'Read Along'}</Text>
          <TouchableOpacity onPress={onClose} style={styles.headerButton}>
            <Ionicons name="close" size={24} color={colors.gray[600]} />
          </TouchableOpacity>
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="document-text-outline" size={40} color={colors.gray[400]} />
          <Text style={styles.errorText}>
            {t('readAlong.unavailable') || 'Read Along not available for this track'}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header with title, text size control and close button */}
      {!chromeHidden && (
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t('readAlong.title') || 'Read Along'}</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={cycleSize}
              style={styles.sizeButton}
              accessibilityRole="button"
              accessibilityLabel={t('readAlong.textSize') || 'Text size'}
              testID="read-along-size-toggle"
            >
              <Text style={[styles.aaLabel, { fontSize: 13 + 2 * sizeIndex }]}>Aa</Text>
              <Text style={styles.sizeLabel}>{t('readAlong.textSize') || 'Text size'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onClose}
              style={styles.headerButton}
              accessibilityRole="button"
              accessibilityLabel={t('common.close') || 'Close'}
            >
              <Ionicons name="close" size={24} color={colors.gray[600]} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Transcript text — bottomInset reserves room for the overlay player
          so the last lines can scroll up above the slider. */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomInset }]}
        onLayout={(e) => setScrollViewHeight(e.nativeEvent.layout.height)}
        // A taller or shorter view (bars shown or hidden) recenters through
        // the effect on visibleHeight below.
        onScroll={(e) => {
          scrollYRef.current = e.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={32}
        onScrollBeginDrag={handleScrollBeginDrag}
        onScrollEndDrag={handleScrollEnd}
        onMomentumScrollEnd={handleScrollEnd}
        showsVerticalScrollIndicator={false}
      >
        <View>
          {paragraphs.map((para, paraIdx) => {
            const { activeIdx, isPast } = paragraphProgress(para, effectiveSegmentIndex, effectiveWordIndex);
            const reading = activeIdx >= 0;
            return (
              <ParagraphRow
                key={paraIdx}
                words={para}
                activeIdx={activeIdx}
                isPast={isPast}
                onWordPress={handleWordPress}
                fontSize={textMetrics.fontSize}
                lineHeight={textMetrics.lineHeight}
                layoutKey={layoutKey}
                // Only the paragraph being read reports where its word sits,
                // so the others keep the same props and skip re-rendering.
                onActiveWordLayout={reading ? handleActiveWordLayout : undefined}
              />
            );
          })}
        </View>
      </ScrollView>

      {chromeHidden && onShowChrome && (
        <TouchableOpacity
          onPress={onShowChrome}
          style={styles.showChromeButton}
          accessibilityRole="button"
          accessibilityLabel={t('readAlong.showControls') || 'Show the controls'}
          testID="read-along-show-controls"
        >
          <Ionicons name="ellipsis-horizontal" size={22} color={colors.white} />
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Paragraph Row ──────────────────────────────────────────────────

interface TextLine {
  text: string;
  y: number;
  height: number;
}

interface ParagraphRowProps {
  words: ParaWords;
  activeIdx: number;
  isPast: boolean;
  onWordPress: (word: ReadAlongWord) => void;
  fontSize: number;
  lineHeight: number;
  /** Changes when the text reflows (text size, width). */
  layoutKey: string;
  /** Set only on the paragraph being read: it reports where that word's line sits. */
  onActiveWordLayout?: (y: number, height: number, layoutKey: string) => void;
}

/**
 * One paragraph as a single text with a nested span per word. A view per word
 * made thousands of native views per track, and iOS stalled for seconds
 * re-laying them out after a rotation (the app was killed).
 */
const ParagraphRow = React.memo(function ParagraphRow({
  words,
  activeIdx,
  isPast,
  onWordPress,
  fontSize,
  lineHeight,
  layoutKey,
  onActiveWordLayout,
}: ParagraphRowProps) {
  const paragraphYRef = useRef<number | null>(null);
  const linesRef = useRef<{ lines: TextLine[]; key: string } | null>(null);
  const layoutKeyRef = useRef(layoutKey);
  useEffect(() => {
    layoutKeyRef.current = layoutKey;
  }, [layoutKey]);

  // Character offset of each word in the paragraph's text, to find its line.
  const wordStarts = useMemo(() => wordOffsets(words), [words]);

  const reportActiveWord = useCallback(() => {
    const measured = linesRef.current;
    const paragraphY = paragraphYRef.current;
    if (activeIdx < 0 || !onActiveWordLayout || !measured || paragraphY === null) return;
    // Report the key the lines were measured with, so lines from before a text
    // size change cannot pass for the new layout.
    const target = wordStarts[activeIdx];
    let seen = 0;
    const line =
      measured.lines.find((l) => {
        seen += l.text.length;
        return seen > target;
      }) ?? measured.lines[measured.lines.length - 1];
    if (!line) return;
    onActiveWordLayout(paragraphY + styles.paragraph.paddingVertical + line.y, line.height, measured.key);
  }, [activeIdx, onActiveWordLayout, wordStarts]);

  useEffect(() => {
    reportActiveWord();
  }, [reportActiveWord]);

  // Tapping any blank space in the paragraph (between words, in the margin)
  // seeks to its first word. Word taps still work: the nested span's onPress
  // takes priority over the surrounding Pressable.
  const handleParagraphPress = () => {
    if (words.length > 0) onWordPress(words[0].word);
  };

  return (
    <Pressable
      style={styles.paragraph}
      onPress={handleParagraphPress}
      onLayout={(e) => {
        paragraphYRef.current = e.nativeEvent.layout.y;
        reportActiveWord();
      }}
    >
      <Text
        style={[styles.word, { fontSize, lineHeight, color: FADE_COLORS[isPast ? 3 : 0] }]}
        onTextLayout={(e) => {
          linesRef.current = { lines: e.nativeEvent.lines, key: layoutKeyRef.current };
          reportActiveWord();
        }}
      >
        {words.map((pw, idx) => {
          const isActive = idx === activeIdx;
          // Graduated fade: 0 = future or current, 1 = just passed,
          // 2 = medium past, 3 = far past.
          let fadeTier: 0 | 1 | 2 | 3 = isPast ? 3 : 0;
          if (activeIdx >= 0) {
            const dist = activeIdx - idx; // positive = past
            fadeTier = dist <= 0 ? 0 : dist <= 3 ? 1 : dist <= 12 ? 2 : 3;
          }
          return (
            <React.Fragment key={idx}>
              {idx > 0 ? ' ' : null}
              <WordSpan
                word={pw.word}
                isActive={isActive}
                fadeTier={fadeTier}
                onPress={onWordPress}
                fontSize={fontSize}
                lineHeight={lineHeight}
              />
            </React.Fragment>
          );
        })}
      </Text>
    </Pressable>
  );
});

// ─── Word Span ──────────────────────────────────────────────────────

interface WordSpanProps {
  word: ReadAlongWord;
  isActive: boolean;
  fadeTier: 0 | 1 | 2 | 3;
  onPress: (word: ReadAlongWord) => void;
  fontSize: number;
  lineHeight: number;
}

// Graduated fade colors: future → just passed → medium past → far past
const FADE_COLORS = [
  '#2c2c2c', // 0: future — full darkness
  '#6b7280', // 1: just passed (1-3 words) — still readable
  '#9ca3af', // 2: medium past (4-12 words) — fading
  '#c9cdd3', // 3: far past (13+ words) — faded
] as const;

const WordSpan = React.memo(function WordSpan({ word, isActive, fadeTier, onPress, fontSize, lineHeight }: WordSpanProps) {
  return (
    <Text
      onPress={() => onPress(word)}
      style={[
        styles.word,
        { color: FADE_COLORS[fadeTier], fontSize, lineHeight },
        isActive && styles.wordActive,
      ]}
    >
      {word.word.trim()}
    </Text>
  );
});

// ─── Styles ─────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: 'EBGaramond_600SemiBold',
    color: colors.burgundy[500],
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    minWidth: 44,
    minHeight: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Same look as the player's speed button: bold value over a small label.
  sizeButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  aaLabel: {
    fontWeight: '700',
    color: colors.gray[700],
  },
  sizeLabel: {
    fontSize: 10,
    color: colors.gray[500],
    marginTop: 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  loadingText: {
    fontSize: 15,
    color: colors.gray[500],
    marginTop: 12,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorText: {
    fontSize: 15,
    color: colors.gray[500],
    textAlign: 'center',
    marginTop: 12,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  paragraph: {
    marginBottom: 16,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginHorizontal: -4,
    borderRadius: 6,
  },
  word: {
    fontFamily: 'EBGaramond_400Regular',
    color: colors.gray[800],
  },
  wordActive: {
    color: colors.burgundy[500],
  },
  showChromeButton: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(44,44,44,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
