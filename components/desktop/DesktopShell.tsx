import React, { ReactNode } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDesktopLayout } from '@/hooks/useDesktopLayout';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { colors } from '@/constants/colors';
import { DESKTOP_CONTENT_MAX } from '@/constants/layout';
import { useReaderFullWindow } from '@/utils/readerImmersive';

/** Width of the soft shadows cast onto the main area and the right panel. */
export const EDGE_SHADOW_WIDTH = 12;
const EDGE_SHADOW_COLORS = ['rgba(0,0,0,0.06)', 'rgba(0,0,0,0)'] as const;

/** A vertical shadow falling left to right from the edge it is placed on. */
function EdgeShadow({ testID, style }: { testID: string; style: object }) {
  return (
    <LinearGradient
      testID={testID}
      pointerEvents="none"
      colors={EDGE_SHADOW_COLORS}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={[styles.edgeShadow, style]}
    />
  );
}

/**
 * The central column: at most DESKTOP_CONTENT_MAX wide and centred, white on a light grey
 * ground. `capped` false (document readers) lets it fill the whole area.
 */
function MainColumn({ capped, children }: { capped: boolean; children: ReactNode }) {
  return (
    <View testID="main-column" style={[styles.mainColumn, capped && styles.mainColumnCapped]}>
      {children}
    </View>
  );
}

interface DesktopShellProps {
  sidebar: ReactNode;
  rightSidebar?: ReactNode;
  /** Width of the right rail in pixels. Defaults to the wide brand
   *  panel; pass 64 on screens that need to maximize content width. */
  rightSidebarWidth?: number;
  children: ReactNode;
  playerBar?: ReactNode;
  /** Cap the central column at DESKTOP_CONTENT_MAX (default). Document readers turn it off. */
  capContent?: boolean;
}

export function DesktopShell({
  sidebar,
  rightSidebar,
  rightSidebarWidth = 220,
  children,
  playerBar,
  capContent = true,
}: DesktopShellProps) {
  const { sidebarWidth, playerBarHeight, showSidebar, showRightRail, isMobile } = useDesktopLayout();

  // Activate keyboard shortcuts for audio playback on web
  useKeyboardShortcuts();

  const insets = useSafeAreaInsets();
  // A document reader open: it takes the whole window, so the sidebar, the
  // right panel and the player bar step aside (kept mounted, only hidden, so
  // the navigator and the player never remount).
  const readerOpen = useReaderFullWindow();

  if (Platform.OS !== 'web') {
    return (
      <NativeShell
        sidebar={sidebar}
        rightSidebar={rightSidebar}
        rightSidebarWidth={rightSidebarWidth}
        playerBar={playerBar}
        sidebarWidth={sidebarWidth}
        playerBarHeight={playerBarHeight}
        insets={insets}
        showSidebar={showSidebar && !readerOpen}
        showRightRail={showRightRail && !readerOpen}
        showPlayerBar={!isMobile && !readerOpen}
        capContent={capContent}
      >
        {children}
      </NativeShell>
    );
  }

  const gridColumns = readerOpen
    ? '1fr'
    : rightSidebar
      ? `${sidebarWidth}px 1fr ${rightSidebarWidth}px`
      : `${sidebarWidth}px 1fr`;
  const showPlayerRow = !!playerBar && !readerOpen;

  return (
    <View
      style={[
        styles.shell,
        Platform.OS === 'web' && ({
          display: 'grid' as any,
          gridTemplateColumns: gridColumns,
          gridTemplateRows: showPlayerRow ? `1fr ${playerBarHeight}px` : '1fr',
          height: '100vh',
          overflow: 'hidden',
        } as any),
      ]}
    >
      <View
        style={[
          styles.sidebarContainer,
          { width: sidebarWidth },
          readerOpen && styles.hidden,
          Platform.OS === 'web' && ({
            gridColumn: '1',
            gridRow: '1',
            overflow: 'auto' as any,
          } as any),
        ]}
      >
        {sidebar}
      </View>

      <View
        style={[
          styles.mainContent,
          Platform.OS === 'web' && ({
            gridColumn: readerOpen ? '1' : '2',
            gridRow: '1',
            overflow: 'auto' as any,
          } as any),
        ]}
      >
        <MainColumn capped={capContent && !readerOpen}>{children}</MainColumn>
      </View>

      {rightSidebar && (
        <View
          style={[
            styles.rightSidebarContainer,
            { width: rightSidebarWidth },
            readerOpen && styles.hidden,
            Platform.OS === 'web' && ({
              gridColumn: '3',
              gridRow: '1',
              // overflow: 'visible' so the account dropdown menu can
              // extend leftward past the rail edge in narrow mode.
              overflow: 'visible' as any,
            } as any),
          ]}
        >
          {rightSidebar}
        </View>
      )}

      {/* Sidebar onto main area, main area onto the red panel. */}
      {!readerOpen && (
        <EdgeShadow
          testID="shadow-main-left"
          style={{ left: sidebarWidth, bottom: playerBar ? playerBarHeight : 0 }}
        />
      )}
      {rightSidebar && !readerOpen && (
        <EdgeShadow
          testID="shadow-right-panel-left"
          style={{
            right: rightSidebarWidth - EDGE_SHADOW_WIDTH,
            bottom: playerBar ? playerBarHeight : 0,
          }}
        />
      )}

      {playerBar && (
        <View
          style={[
            styles.playerBar,
            readerOpen && styles.hidden,
            { height: playerBarHeight },
            Platform.OS === 'web' && ({
              gridColumn: '1 / -1',
              gridRow: '2',
            } as any),
          ]}
        >
          {playerBar}
        </View>
      )}
    </View>
  );
}

interface NativeShellProps extends DesktopShellProps {
  sidebarWidth: number;
  playerBarHeight: number;
  insets: { top: number; bottom: number; left: number; right: number };
  showSidebar: boolean;
  showRightRail: boolean;
  showPlayerBar: boolean;
}

/**
 * Native (iPad) shell: a flex row for the rails and content, the player bar
 * underneath. Rails absorb the safe-area insets (status bar on top, the
 * notch / rounded corners on the sides); the player bar absorbs the home
 * indicator. The main pane keeps the full height, screens handle their own
 * top inset like they do on the phone layout.
 *
 * The tree is identical in every mode: slots that are hidden (phone-width
 * Split View, tablet without a right rail) keep their container and render
 * nothing inside, so `children` (the navigator) never remounts when the
 * width crosses a breakpoint.
 */
function NativeShell({
  sidebar,
  rightSidebar,
  rightSidebarWidth = 220,
  children,
  playerBar,
  capContent = true,
  sidebarWidth,
  playerBarHeight,
  insets,
  showSidebar,
  showRightRail,
  showPlayerBar,
}: NativeShellProps) {
  return (
    <View style={styles.nativeShell}>
      <View style={styles.nativeRow}>
        <View
          style={[
            styles.sidebarContainer,
            showSidebar
              ? {
                  width: sidebarWidth + insets.left,
                  paddingLeft: insets.left,
                  paddingTop: insets.top,
                }
              : styles.hidden,
          ]}
        >
          {showSidebar ? sidebar : null}
        </View>
        <View style={[styles.nativeMain, showSidebar && styles.nativeMainFilled]}>
          <MainColumn capped={capContent && showSidebar}>{children}</MainColumn>
        </View>
        <View
          style={[
            styles.rightSidebarContainer,
            showRightRail && rightSidebar
              ? {
                  width: rightSidebarWidth + insets.right,
                  paddingRight: insets.right,
                  paddingTop: insets.top,
                }
              : styles.hidden,
          ]}
        >
          {showRightRail ? rightSidebar : null}
        </View>
      </View>
      <View
        style={[
          styles.playerBar,
          showPlayerBar && playerBar
            ? {
                height: playerBarHeight + insets.bottom,
                paddingBottom: insets.bottom,
                paddingLeft: insets.left,
                paddingRight: insets.right,
              }
            : styles.hidden,
        ]}
      >
        {showPlayerBar ? playerBar : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  nativeShell: {
    flex: 1,
    flexDirection: 'column',
    backgroundColor: colors.white,
  },
  nativeRow: {
    flex: 1,
    flexDirection: 'row',
    minHeight: 0,
  },
  hidden: {
    display: 'none',
  },
  nativeMain: {
    flex: 1,
    minWidth: 0,
  },
  nativeMainFilled: {
    backgroundColor: colors.cream[200],
  },
  mainColumn: {
    flex: 1,
    minHeight: 0,
    minWidth: 0,
    backgroundColor: colors.cream[100],
  },
  mainColumnCapped: {
    width: '100%',
    maxWidth: DESKTOP_CONTENT_MAX,
    alignSelf: 'center',
  },
  shell: {
    flex: 1,
  },
  edgeShadow: {
    position: 'absolute',
    top: 0,
    width: EDGE_SHADOW_WIDTH,
    zIndex: 5,
  },
  sidebarContainer: {
    backgroundColor: colors.white,
    borderRightWidth: 1,
    borderRightColor: colors.gray[200],
  },
  mainContent: {
    flex: 1,
    // Light grey around the capped column (see MainColumn).
    backgroundColor: colors.cream[200],
  },
  rightSidebarContainer: {
    backgroundColor: colors.burgundy[500],
  },
  playerBar: {
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.gray[200],
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 8,
  },
});
