import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';
import { useLanguage } from '@/contexts/LanguageContext';
import { ContinuousIcon } from './icons/ContinuousIcon';
import { SinglePageIcon } from './icons/SinglePageIcon';
import { SpreadIcon } from './icons/SpreadIcon';
import { FitWidthIcon } from './icons/FitWidthIcon';
import { FitHeightIcon } from './icons/FitHeightIcon';
import { READING_THEMES, themeSurfaces, type ReadingTheme } from '@/utils/pdfReadingTheme';
import type { ViewMode, Zoom } from '@/utils/pdfViewerLayout';

const THEME_FALLBACK_LABELS: Record<ReadingTheme, string> = {
  normal: 'Normal',
  sepia: 'Sepia',
  night: 'Night (negative)',
};

interface PdfViewOptionsPanelProps {
  /** Distance from the top of the viewer: the panel opens below the screen's bar. */
  top: number;
  onClose: () => void;
  mode: ViewMode;
  onMode: (mode: ViewMode) => void;
  zoom: Zoom;
  onFit: (preset: 'fit-width' | 'fit-page') => void;
  zoomPercent: string;
  onZoomOut: () => void;
  onZoomIn: () => void;
  canZoomOut: boolean;
  canZoomIn: boolean;
  theme: ReadingTheme;
  onTheme: (theme: ReadingTheme) => void;
  /** Page on screen, document length, and a way to move. */
  page: number;
  total: number;
  onGoTo: (page: number) => void;
  onPrevious: () => void;
  onNext: () => void;
  atFirst: boolean;
  atLast: boolean;
  onDownload?: () => void;
  fullscreen?: { active: boolean; onToggle: () => void } | null;
}

/**
 * The web reader's viewing options, in one popover opened from the reader's
 * top bar: page layout, fit, zoom, reading theme, a page to go to, download
 * and full screen. A click outside, or Escape, closes it.
 */
export function PdfViewOptionsPanel(props: PdfViewOptionsPanelProps) {
  const { t } = useLanguage();
  const { onClose } = props;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  // The page field shows the page on screen until the reader types in it.
  const [draft, setDraft] = useState<string | null>(null);
  const submitPage = () => {
    const wanted = parseInt(draft ?? '', 10);
    if (Number.isFinite(wanted)) props.onGoTo(wanted);
    setDraft(null);
  };

  const icon = (Icon: React.ComponentType<{ size?: number; color?: string }>, active: boolean) => (
    <Icon size={20} color={active ? colors.burgundy[500] : colors.gray[600]} />
  );

  return (
    <>
      <Pressable
        testID="pdf-options-backdrop"
        style={styles.backdrop}
        onPress={onClose}
        accessibilityLabel={t('common.close') || 'Close'}
      />
      <View
        testID="pdf-options-panel"
        style={[styles.panel, { top: props.top + 6 }]}
        accessibilityRole="menu"
        accessibilityLabel={t('pdfViewer.viewOptions') || 'View options'}
      >
        <Text style={styles.sectionLabel}>{t('pdfViewer.pageLayout') || 'Page layout'}</Text>
        <View style={styles.row}>
          <Choice
            label={t('pdfViewer.continuous') || 'Continuous scroll'}
            short={t('pdfViewer.continuousShort') || 'Scroll'}
            active={props.mode === 'continuous'}
            onPress={() => props.onMode('continuous')}
          >
            {icon(ContinuousIcon, props.mode === 'continuous')}
          </Choice>
          <Choice
            label={t('pdfViewer.singlePage') || 'Single page'}
            short={t('pdfViewer.singlePageShort') || 'Single'}
            active={props.mode === 'single'}
            onPress={() => props.onMode('single')}
          >
            {icon(SinglePageIcon, props.mode === 'single')}
          </Choice>
          <Choice
            label={t('pdfViewer.twoPages') || 'Two pages'}
            short={t('pdfViewer.twoPagesShort') || 'Two'}
            active={props.mode === 'two'}
            onPress={() => props.onMode('two')}
          >
            {icon(SpreadIcon, props.mode === 'two')}
          </Choice>
        </View>

        <Text style={styles.sectionLabel}>{t('pdfViewer.fit') || 'Fit'}</Text>
        <View style={styles.row}>
          <Choice
            label={t('pdfViewer.fitWidth') || 'Fit width'}
            short={t('pdfViewer.fitWidth') || 'Fit width'}
            active={props.zoom.kind === 'fit-width'}
            onPress={() => props.onFit('fit-width')}
          >
            {icon(FitWidthIcon, props.zoom.kind === 'fit-width')}
          </Choice>
          <Choice
            label={t('pdfViewer.fitPage') || 'Fit page'}
            short={t('pdfViewer.fitPage') || 'Fit page'}
            active={props.zoom.kind === 'fit-page'}
            onPress={() => props.onFit('fit-page')}
          >
            {icon(FitHeightIcon, props.zoom.kind === 'fit-page')}
          </Choice>
        </View>

        <Text style={styles.sectionLabel}>{t('pdfViewer.zoom') || 'Zoom'}</Text>
        <View style={styles.stepper}>
          <StepButton label={t('pdfViewer.zoomOut') || 'Zoom out'} onPress={props.onZoomOut} disabled={!props.canZoomOut}>
            <Ionicons name="remove" size={18} color={colors.gray[700]} />
          </StepButton>
          <Text
            style={styles.stepperValue}
            accessibilityLabel={t('pdfViewer.zoomLevel', { percent: props.zoomPercent }) || `Zoom ${props.zoomPercent}`}
          >
            {props.zoomPercent}
          </Text>
          <StepButton label={t('pdfViewer.zoomIn') || 'Zoom in'} onPress={props.onZoomIn} disabled={!props.canZoomIn}>
            <Ionicons name="add" size={18} color={colors.gray[700]} />
          </StepButton>
        </View>

        <Text style={styles.sectionLabel}>{t('pdfViewer.readingTheme') || 'Reading theme'}</Text>
        <View style={styles.row}>
          {READING_THEMES.map((option) => {
            const active = props.theme === option;
            return (
              <Choice
                key={option}
                label={t(`pdfViewer.theme.${option}`) || THEME_FALLBACK_LABELS[option]}
                short={t(`pdfViewer.themeShort.${option}`) || option[0].toUpperCase() + option.slice(1)}
                active={active}
                onPress={() => props.onTheme(option)}
              >
                <View
                  style={[
                    styles.swatch,
                    { backgroundColor: themeSurfaces(option).paper },
                    active && styles.swatchActive,
                  ]}
                />
              </Choice>
            );
          })}
        </View>

        {props.total ? (
          <>
            <Text style={styles.sectionLabel}>{t('pdfViewer.goToPage') || 'Go to page'}</Text>
            <View style={styles.stepper}>
              <StepButton label={t('pdfViewer.previousPage') || 'Previous page'} onPress={props.onPrevious} disabled={props.atFirst}>
                <Ionicons name="chevron-back" size={18} color={colors.gray[700]} />
              </StepButton>
              <View style={styles.pageField}>
                <TextInput
                  testID="pdf-options-page-input"
                  style={styles.pageInput}
                  value={draft ?? String(props.page)}
                  onChangeText={(text) => setDraft(text.replace(/[^0-9]/g, ''))}
                  onFocus={() => setDraft('')}
                  onBlur={() => setDraft(null)}
                  onSubmitEditing={submitPage}
                  keyboardType="number-pad"
                  selectTextOnFocus
                  accessibilityLabel={t('pdfViewer.goToPage') || 'Go to page'}
                />
                <Text style={styles.pageTotal}>/ {props.total}</Text>
              </View>
              <StepButton label={t('pdfViewer.nextPage') || 'Next page'} onPress={props.onNext} disabled={props.atLast}>
                <Ionicons name="chevron-forward" size={18} color={colors.gray[700]} />
              </StepButton>
            </View>
          </>
        ) : null}

        {props.onDownload || props.fullscreen ? <View style={styles.separator} /> : null}
        {props.onDownload ? (
          <MenuAction
            label={t('transcript.downloadPdf') || 'Download PDF'}
            icon="download-outline"
            onPress={() => {
              props.onDownload?.();
              onClose();
            }}
          />
        ) : null}
        {props.fullscreen ? (
          <MenuAction
            label={
              props.fullscreen.active
                ? t('pdfViewer.exitFullscreen') || 'Exit fullscreen'
                : t('pdfViewer.enterFullscreen') || 'Enter fullscreen'
            }
            icon={props.fullscreen.active ? 'contract-outline' : 'expand-outline'}
            onPress={() => {
              props.fullscreen?.onToggle();
              onClose();
            }}
          />
        ) : null}
      </View>
    </>
  );
}

function Choice({
  label,
  short,
  active,
  onPress,
  children,
}: {
  label: string;
  short: string;
  active: boolean;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.choice, active && styles.choiceActive]}
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
    >
      {children}
      <Text style={[styles.choiceText, active && styles.choiceTextActive]} numberOfLines={1}>
        {short}
      </Text>
    </Pressable>
  );
}

function StepButton({
  label,
  onPress,
  disabled,
  children,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.stepButton, disabled && styles.disabled]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
    >
      {children}
    </Pressable>
  );
}

function MenuAction({ label, icon, onPress }: { label: string; icon: React.ComponentProps<typeof Ionicons>['name']; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.action} accessibilityRole="menuitem" accessibilityLabel={label}>
      <Ionicons name={icon} size={18} color={colors.gray[700]} />
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Covers the viewer so a click outside the panel closes it instead of
  // reaching the page (which would toggle the bars).
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 20,
  },
  panel: {
    position: 'absolute',
    right: 12,
    width: 320,
    maxWidth: '94%',
    zIndex: 21,
    padding: 14,
    borderRadius: 12,
    backgroundColor: colors.white,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.gray[200],
    boxShadow: '0px 8px 28px rgba(0, 0, 0, 0.18)',
  },
  sectionLabel: {
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.gray[500],
    marginTop: 12,
    marginBottom: 6,
  },
  row: {
    flexDirection: 'row',
    gap: 6,
  },
  choice: {
    flex: 1,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.gray[200],
    paddingHorizontal: 4,
    // @ts-ignore - web only
    cursor: 'pointer',
  },
  choiceActive: {
    backgroundColor: colors.burgundy[50],
    borderColor: colors.burgundy[500],
  },
  choiceText: {
    fontSize: 12,
    color: colors.gray[600],
  },
  choiceTextActive: {
    color: colors.burgundy[500],
  },
  swatch: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.gray[400],
  },
  swatchActive: {
    borderColor: colors.burgundy[500],
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.gray[200],
  },
  stepButton: {
    width: 44,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    // @ts-ignore - web only
    cursor: 'pointer',
  },
  disabled: {
    opacity: 0.35,
    // @ts-ignore - web only
    cursor: 'default',
  },
  stepperValue: {
    fontSize: 14,
    color: colors.gray[700],
    fontVariant: ['tabular-nums'],
  },
  pageField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pageInput: {
    width: 52,
    height: 28,
    textAlign: 'center',
    fontSize: 14,
    color: colors.gray[700],
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.gray[200],
    fontVariant: ['tabular-nums'],
    paddingVertical: 0,
  },
  pageTotal: {
    fontSize: 14,
    color: colors.gray[500],
    fontVariant: ['tabular-nums'],
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.gray[200],
    marginTop: 14,
    marginBottom: 4,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 40,
    // @ts-ignore - web only
    cursor: 'pointer',
  },
  actionText: {
    fontSize: 14,
    color: colors.gray[700],
  },
});
