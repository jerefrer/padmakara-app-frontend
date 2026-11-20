import React, { ReactNode } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDesktopLayout } from '@/hooks/useDesktopLayout';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { colors } from '@/constants/colors';
import { DESKTOP_APP_MAX_WIDTH } from '@/constants/layout';
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

interface DesktopShellProps {
  sidebar: ReactNode;
  rightSidebar?: ReactNode;
  /** Width of the right rail in pixels. Defaults to the wide brand
   *  panel; pass 64 on screens that need to maximize content width. */
  rightSidebarWidth?: number;
  children: ReactNode;
  playerBar?: ReactNode;
  /**
   * Frame the app (sidebar, content, right panel, player bar) as one block of at most
   * DESKTOP_APP_MAX_WIDTH, centred, with light grey on both sides (default). Screens that
   * need the whole window (document readers) turn it off. Web only: an iPad always fills the screen.
   */
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
    <View style={styles.appGround}>
    <View
      testID="app-block"
      style={[
        styles.shell,
        capContent && !readerOpen && styles.appBlockCapped,
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
        {children}
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
        <View style={styles.nativeMain}>
          {children}
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
  // The grey ground the framed app block stands on (web only).
  appGround: {
    flex: 1,
    backgroundColor: colors.cream[200],
  },
  appBlockCapped: {
    width: '100%',
    maxWidth: DESKTOP_APP_MAX_WIDTH,
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
    backgroundColor: colors.cream[100],
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
