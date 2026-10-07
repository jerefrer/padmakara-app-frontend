import React, { useEffect, useId, useRef } from 'react';
import { View } from 'react-native';
import type { EasypayCheckoutProps } from './easypayTypes';

const SDK_SRC = 'https://cdn.easypay.pt/checkout/2.9.1/';

interface EasypayInstance {
  unmount(): void;
}
interface EasypaySdk {
  startCheckout(manifest: { id: string; session: string }, options: Record<string, unknown>): EasypayInstance;
}

let sdkLoading: Promise<void> | null = null;

/** Test hook: forget a script load still in flight. */
export function resetEasypayLoader() {
  sdkLoading = null;
}

/** Loads Easypay's script once per page; resolves at once if it is already there. */
function loadSdk(): Promise<void> {
  if ((window as any).easypayCheckout) return Promise.resolve();
  if (sdkLoading) return sdkLoading;
  sdkLoading = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SDK_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      sdkLoading = null;
      script.remove();
      reject(new Error('Easypay checkout script failed to load'));
    };
    document.head.appendChild(script);
  });
  return sdkLoading;
}

/** Easypay's inline form, tinted with the app's burgundy, square corners, no shadows. */
export function EasypayCheckout(props: EasypayCheckoutProps) {
  const { manifest, testing, language } = props;
  // Callbacks change on every render of the parent; the form must not remount for that.
  const callbacks = useRef(props);
  callbacks.current = props;
  // One container per instance: a stale pay screen left mounted must not capture this form.
  const containerId = `easypay-checkout-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

  useEffect(() => {
    let cancelled = false;
    let settled = false;
    let instance: EasypayInstance | null = null;
    const fatal = () => {
      if (!cancelled) callbacks.current.onFatal();
    };

    loadSdk()
      .then(() => {
        if (cancelled) return;
        const sdk = (window as any).easypayCheckout as EasypaySdk | undefined;
        if (!sdk) return fatal();
        instance = sdk.startCheckout(manifest, {
          id: containerId,
          display: 'inline',
          testing,
          language: language === 'pt' ? 'pt_PT' : 'en',
          accentColor: '#9b1b1b',
          buttonBackgroundColor: '#9b1b1b',
          inputBorderRadius: 2,
          buttonBorderRadius: 2,
          buttonBoxShadow: false,
          backgroundColor: '#ffffff',
          // The SDK may fire onClose after onSuccess, or anything after unmount: only the first
          // outcome counts, and nothing counts once the component is gone. A decline is retryable.
          onSuccess: () => {
            if (cancelled || settled) return;
            settled = true;
            callbacks.current.onSuccess();
          },
          onClose: () => {
            if (cancelled || settled) return;
            settled = true;
            callbacks.current.onClose();
          },
          onPaymentError: () => {
            if (cancelled) return;
            callbacks.current.onPaymentError();
          },
          onError: () => {
            if (cancelled || settled) return;
            settled = true;
            callbacks.current.onFatal();
          },
        });
      })
      .catch(fatal);

    return () => {
      cancelled = true;
      try {
        instance?.unmount();
      } catch {
        // The SDK may throw when unmounting an instance it has already closed itself.
      }
      instance = null;
    };
  }, [manifest.id, manifest.session, testing, language, containerId]);

  return <View nativeID={containerId} style={{ width: '100%', minHeight: 320 }} />;
}
