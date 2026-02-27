import { useAudioPlayerContext } from '@/contexts/AudioPlayerContext';
import { useLanguage } from '@/contexts/LanguageContext';
import readAlongService from '@/services/readAlongService';
import { ReadAlongData, ReadAlongWord } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const colors = {
  burgundy: {
    50: '#fef2f2',
    100: '#fde6e6',
    500: '#b91c1c',
    600: '#991b1b',
  },
  gray: {
    100: '#f3f4f6',
    200: '#e5e7eb',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
  },
  white: '#ffffff',
};

interface ReadAlongViewerProps {
  /** Pre-loaded alignment data (preferred) */
  readAlongData?: ReadAlongData | null;
  /** URL to fetch alignment data from (fallback) */
  readAlongUrl?: string;
  onClose: () => void;
}

/**
 * Displays transcript text with word-level highlighting synced to audio playback.
 * Words are tappable to seek to that position.
 */
export function ReadAlongViewer({ readAlongData: preloadedData, readAlongUrl, onClose }: ReadAlongViewerProps) {
  const { t } = useLanguage();
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

  const [data, setData] = useState<ReadAlongData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);

  const scrollViewRef = useRef<ScrollView>(null);
  const paraLayoutsRef = useRef<Map<number, number>>(new Map());
  const lastScrolledParaRef = useRef<number>(-1);
  const userScrollingRef = useRef(false);
  const userScrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

    readAlongService.loadAlignment(readAlongUrl).then((result) => {
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

  // Merge Whisper segments into visual paragraphs based on time gaps.
  // Segments often contain just 1-2 words; rendering each as a block
  // creates ugly line breaks. Instead, merge into flowing paragraphs
  // and only break on significant pauses (> PARAGRAPH_GAP seconds).
  const PARAGRAPH_GAP = 4; // seconds of silence → new paragraph

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
        if (seg.start - lastWord.end > PARAGRAPH_GAP) {
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

  // Find which paragraph the active word is in (for auto-scroll)
  const activeParaIndex = useMemo(() => {
    if (activeSegmentIndex < 0) return -1;
    return paragraphs.findIndex((para) =>
      para.some((pw) => pw.segIdx === activeSegmentIndex),
    );
  }, [paragraphs, activeSegmentIndex]);

  // Auto-scroll to keep the active paragraph visible
  useEffect(() => {
    if (!autoScroll || !isPlaying || activeParaIndex < 0) return;
    if (activeParaIndex === lastScrolledParaRef.current) return;
    if (userScrollingRef.current) return;

    const yOffset = paraLayoutsRef.current.get(activeParaIndex);
    if (yOffset !== undefined && scrollViewRef.current) {
      scrollViewRef.current.scrollTo({ y: Math.max(0, yOffset - 120), animated: true });
      lastScrolledParaRef.current = activeParaIndex;
    }
  }, [activeParaIndex, autoScroll, isPlaying]);

  // Detect manual user scrolling — temporarily pause auto-scroll
  const handleScrollBeginDrag = useCallback(() => {
    userScrollingRef.current = true;
    if (userScrollTimerRef.current) clearTimeout(userScrollTimerRef.current);
  }, []);

  const handleScrollEndDrag = useCallback(() => {
    // Resume auto-scroll after 5 seconds of no user scrolling
    userScrollTimerRef.current = setTimeout(() => {
      userScrollingRef.current = false;
    }, 5000);
  }, []);

  // Tap a word to seek
  const handleWordPress = useCallback((word: ReadAlongWord) => {
    seekTo(word.start * 1000); // seekTo takes milliseconds
  }, [seekTo]);

  // Record layout position of each paragraph for auto-scroll
  const handleParaLayout = useCallback((index: number, y: number) => {
    paraLayoutsRef.current.set(index, y);
  }, []);

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t('readAlong.title') || 'Read Along'}</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
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
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
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
      {/* Header with title and controls */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('readAlong.title') || 'Read Along'}</Text>
        <View style={styles.headerControls}>
          <TouchableOpacity
            onPress={() => setAutoScroll(!autoScroll)}
            style={[styles.autoScrollButton, autoScroll && styles.autoScrollButtonActive]}
          >
            <Ionicons
              name="locate-outline"
              size={18}
              color={autoScroll ? colors.burgundy[500] : colors.gray[400]}
            />
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={colors.gray[600]} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Transcript text */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        onScrollBeginDrag={handleScrollBeginDrag}
        onScrollEndDrag={handleScrollEndDrag}
        showsVerticalScrollIndicator={false}
      >
        {paragraphs.map((para, paraIdx) => (
          <ParagraphRow
            key={paraIdx}
            words={para}
            paraIndex={paraIdx}
            activeSegmentIndex={activeSegmentIndex}
            activeWordIndex={activeWordIndex}
            onWordPress={handleWordPress}
            onLayout={handleParaLayout}
          />
        ))}
        {/* Bottom padding for comfortable scrolling */}
        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

// ─── Paragraph Row ──────────────────────────────────────────────────

interface ParagraphRowProps {
  words: { word: ReadAlongWord; segIdx: number; wordIdx: number }[];
  paraIndex: number;
  activeSegmentIndex: number;
  activeWordIndex: number;
  onWordPress: (word: ReadAlongWord) => void;
  onLayout: (index: number, y: number) => void;
}

const ParagraphRow = React.memo(function ParagraphRow({
  words,
  paraIndex,
  activeSegmentIndex,
  activeWordIndex,
  onWordPress,
  onLayout,
}: ParagraphRowProps) {
  return (
    <View
      style={styles.paragraph}
      onLayout={(e) => onLayout(paraIndex, e.nativeEvent.layout.y)}
    >
      <Text style={styles.paragraphText}>
        {words.map((pw, idx) => {
          const isActive = pw.segIdx === activeSegmentIndex && pw.wordIdx === activeWordIndex;
          const isPast =
            activeSegmentIndex >= 0 &&
            (pw.segIdx < activeSegmentIndex ||
              (pw.segIdx === activeSegmentIndex && activeWordIndex >= 0 && pw.wordIdx < activeWordIndex));
          return (
            <WordSpan
              key={idx}
              word={pw.word}
              isActive={isActive}
              isPast={isPast}
              onPress={onWordPress}
            />
          );
        })}
      </Text>
    </View>
  );
});

// ─── Word Span ──────────────────────────────────────────────────────

interface WordSpanProps {
  word: ReadAlongWord;
  isActive: boolean;
  isPast: boolean;
  onPress: (word: ReadAlongWord) => void;
}

const WordSpan = React.memo(function WordSpan({ word, isActive, isPast, onPress }: WordSpanProps) {
  const isLowConfidence = word.confidence === 'low';

  return (
    <Text
      onPress={() => onPress(word)}
      style={[
        styles.word,
        isLowConfidence && styles.wordLowConfidence,
        isPast && styles.wordPast,
        isActive && styles.wordActive,
      ]}
    >
      {word.word}{' '}
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
    fontWeight: '600',
    color: colors.burgundy[500],
  },
  headerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  autoScrollButton: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: colors.gray[100],
  },
  autoScrollButtonActive: {
    backgroundColor: colors.burgundy[50],
  },
  closeButton: {
    padding: 4,
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
    paddingHorizontal: 4,
  },
  paragraphText: {
    fontSize: 18,
    lineHeight: 30,
    color: colors.gray[800],
  },
  word: {
    color: colors.gray[800],
  },
  wordLowConfidence: {
    opacity: 0.5,
  },
  wordPast: {
    color: colors.gray[500],
  },
  wordActive: {
    backgroundColor: colors.burgundy[500],
    color: colors.white,
  },
});
