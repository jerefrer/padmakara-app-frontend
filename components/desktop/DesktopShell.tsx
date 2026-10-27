import React, { ReactNode } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDesktopLayout } from '@/hooks/useDesktopLayout';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { colors } from '@/constants/colors';

interface DesktopShellProps {
  sidebar: ReactNode;
  rightSidebar?: ReactNode;
  /** Width of the right rail in pixels. Defaults to the wide brand
   *  panel; pass 64 on screens that need to maximize content width. */
  rightSidebarWidth?: number;
  children: ReactNode;
  playerBar?: ReactNode;
}

export function DesktopShell({
  sidebar,
  rightSidebar,
  rightSidebarWidth = 220,
  children,
  playerBar,
}: DesktopShellProps) {
  const { sidebarWidth, playerBarHeight } = useDesktopLayout();

  // Activate keyboard shortcuts for audio playback on web
  useKeyboardShortcuts();

  const insets = useSafeAreaInsets();

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
      >
        {children}
      </NativeShell>
    );
  }

  const gridColumns = rightSidebar
    ? `${sidebarWidth}px 1fr ${rightSidebarWidth}px`
    : `${sidebarWidth}px 1fr`;

  return (
    <View
      style={[
        styles.shell,
        Platform.OS === 'web' && ({
          display: 'grid' as any,
          gridTemplateColumns: gridColumns,
          gridTemplateRows: playerBar ? `1fr ${playerBarHeight}px` : '1fr',
          height: '100vh',
          overflow: 'hidden',
        } as any),
      ]}
    >
      <View
        style={[
          styles.sidebarContainer,
          { width: sidebarWidth },
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
            gridColumn: '2',
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

      {playerBar && (
        <View
          style={[
            styles.playerBar,
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
}

/**
 * Native (iPad) shell: a flex row for the rails and content, the player bar
 * underneath. Rails absorb the safe-area insets (status bar on top, the
 * notch / rounded corners on the sides); the player bar absorbs the home
 * indicator. The main pane keeps the full height, screens handle their own
 * top inset like they do on the phone layout.
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
}: NativeShellProps) {
  return (
    <View style={styles.nativeShell}>
      <View style={styles.nativeRow}>
        <View
          style={[
            styles.sidebarContainer,
            {
              width: sidebarWidth + insets.left,
              paddingLeft: insets.left,
              paddingTop: insets.top,
            },
          ]}
        >
          {sidebar}
        </View>
        <View style={styles.nativeMain}>{children}</View>
        {rightSidebar && (
          <View
            style={[
              styles.rightSidebarContainer,
              {
                width: rightSidebarWidth + insets.right,
                paddingRight: insets.right,
                paddingTop: insets.top,
              },
            ]}
          >
            {rightSidebar}
          </View>
        )}
      </View>
      {playerBar && (
        <View
          style={[
            styles.playerBar,
            {
              height: playerBarHeight + insets.bottom,
              paddingBottom: insets.bottom,
              paddingLeft: insets.left,
              paddingRight: insets.right,
            },
          ]}
        >
          {playerBar}
        </View>
      )}
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
  nativeMain: {
    flex: 1,
    minWidth: 0,
    backgroundColor: colors.cream[100],
  },
  shell: {
    flex: 1,
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
