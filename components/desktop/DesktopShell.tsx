import React, { ReactNode } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { useDesktopLayout } from '@/hooks/useDesktopLayout';
import { colors } from '@/constants/colors';

interface DesktopShellProps {
  sidebar: ReactNode;
  children: ReactNode;
  playerBar?: ReactNode;
}

export function DesktopShell({ sidebar, children, playerBar }: DesktopShellProps) {
  const { sidebarWidth, playerBarHeight } = useDesktopLayout();

  return (
    <View
      style={[
        styles.shell,
        Platform.OS === 'web' && ({
          display: 'grid' as any,
          gridTemplateColumns: `${sidebarWidth}px 1fr`,
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

const styles = StyleSheet.create({
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
