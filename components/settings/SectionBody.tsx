import React from 'react';
import { WebMembershipBody } from '@/components/membership/WebMembershipBody';
import { LanguageSection, ProfileSection, RetreatsSection } from './AccountSections';
import { AboutSection, OfflineSection, SignInSection, VideoSection } from './DeviceSections';
import type { SectionId } from './sections';

const BODIES: Record<SectionId, React.ComponentType> = {
  profile: ProfileSection,
  language: LanguageSection,
  membership: WebMembershipBody,
  retreats: RetreatsSection,
  video: VideoSection,
  storage: OfflineSection,
  signin: SignInSection,
  about: AboutSection,
};

/** The membership pages carry their own title; every other section gets one from its caller. */
export const SECTIONS_WITH_OWN_TITLE: ReadonlySet<SectionId> = new Set(['membership']);

export function SectionBody({ id }: { id: SectionId }) {
  const Body = BODIES[id];
  return <Body />;
}
