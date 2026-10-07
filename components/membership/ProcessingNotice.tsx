import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { OutcomeLayout } from './OutcomeLayout';
import { tr } from './tr';

/** A first payment is at the bank (Direct Debit). Shared by the confirming and membership screens. */
export function ProcessingNotice({ onBack, showBack = true }: { onBack: () => void; showBack?: boolean }) {
  const { t } = useLanguage();
  return (
    <OutcomeLayout
      showBack={showBack}
      icon="⏳"
      title={tr(t, 'processingTitle', 'Your bank is processing the payment')}
      body={tr(
        t,
        'processingBody',
        "Direct Debit can take a few days to clear. We'll email you as soon as your membership is active, and the recordings will unlock by themselves.",
      )}
      primary={{ label: tr(t, 'backToPadmakara', 'Back to Padmakara'), onPress: onBack }}
    />
  );
}
