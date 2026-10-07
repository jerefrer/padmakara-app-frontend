import type { EasypayCheckoutProps } from './easypayTypes';

/** Native never shows the payment form (Apple reader-app rule); the web build uses EasypayCheckout.web.tsx. */
export function EasypayCheckout(_props: EasypayCheckoutProps): null {
  return null;
}
