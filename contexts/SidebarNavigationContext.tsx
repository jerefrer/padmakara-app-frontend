import React, { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';

export interface SidebarLevel {
  type: 'groups' | 'retreats' | 'sessions';
  parentId?: string;
  parentName?: string;
}

interface SidebarNavigationContextType {
  level: SidebarLevel;
  drillDown: (type: SidebarLevel['type'], parentId: string, parentName: string) => void;
  goBack: () => void;
  activeItemId: string | null;
  setActiveItem: (id: string | null) => void;
  breadcrumbLabel: string | null;
  /** True when navigation was initiated from the sidebar (prevents route-sync loops). */
  isSidebarNavigation: React.MutableRefObject<boolean>;
}

const SidebarNavigationContext = createContext<SidebarNavigationContextType | undefined>(undefined);

interface SidebarNavigationProviderProps {
  children: ReactNode;
}

export function SidebarNavigationProvider({ children }: SidebarNavigationProviderProps) {
  const [levelStack, setLevelStack] = useState<SidebarLevel[]>([{ type: 'groups' }]);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);

  // Ref to guard against infinite navigation loops between sidebar and route sync.
  const isSidebarNavigation = useRef(false);

  const level = levelStack[levelStack.length - 1];

  const breadcrumbLabel = levelStack.length > 1
    ? levelStack[levelStack.length - 2].parentName || null
    : null;

  const drillDown = useCallback((type: SidebarLevel['type'], parentId: string, parentName: string) => {
    setLevelStack(prev => [...prev, { type, parentId, parentName }]);
    setActiveItemId(null);
  }, []);

  const goBack = useCallback(() => {
    setLevelStack(prev => {
      if (prev.length <= 1) return prev;
      return prev.slice(0, -1);
    });
    setActiveItemId(null);
  }, []);

  const setActiveItem = useCallback((id: string | null) => {
    setActiveItemId(id);
  }, []);

  /**
   * Reset the stack to a specific state. Used by route synchronization
   * to align sidebar state with an externally-triggered navigation.
   */

  const value: SidebarNavigationContextType = {
    level,
    drillDown,
    goBack,
    activeItemId,
    setActiveItem,
    breadcrumbLabel,
    isSidebarNavigation,
  };

  return (
    <SidebarNavigationContext.Provider value={value}>
      {children}
    </SidebarNavigationContext.Provider>
  );
}

export function useSidebarNavigation(): SidebarNavigationContextType {
  const context = useContext(SidebarNavigationContext);
  if (context === undefined) {
    throw new Error('useSidebarNavigation must be used within a SidebarNavigationProvider');
  }
  return context;
}
