import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';

export interface RelatedEventsMeta {
  eventId: string;
  teacherAbbreviation?: string | null;
  groupId?: string | null;
  headerTitle?: string;
  headerSubtitle?: string;
}

interface Ctx {
  meta: RelatedEventsMeta | null;
  setMeta: (m: RelatedEventsMeta | null) => void;
}

const RelatedEventsContext = createContext<Ctx | undefined>(undefined);

// Lives in (groups)/_layout.tsx so the desktop sidebar that consumes it
// is mounted above the Stack — navigating between sibling events updates
// `meta` without remounting the sidebar (no flash, no refetch).
export function RelatedEventsProvider({ children }: { children: ReactNode }) {
  const [meta, setMetaState] = useState<RelatedEventsMeta | null>(null);
  const setMeta = useCallback((m: RelatedEventsMeta | null) => setMetaState(m), []);
  return (
    <RelatedEventsContext.Provider value={{ meta, setMeta }}>
      {children}
    </RelatedEventsContext.Provider>
  );
}

export function useRelatedEvents() {
  const ctx = useContext(RelatedEventsContext);
  if (!ctx) {
    // Returning a no-op keeps screens that aren't under the provider safe.
    return { meta: null, setMeta: () => {} } as Ctx;
  }
  return ctx;
}
