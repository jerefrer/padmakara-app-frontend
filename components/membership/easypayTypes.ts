export interface EasypayCheckoutProps {
  manifest: { id: string; session: string };
  testing: boolean;
  language: 'en' | 'pt';
  /** Hide Easypay's cart badge (it shows the amount, which reads like a charge). */
  hideCart?: boolean;
  onSuccess(): void;
  onClose(): void;
  onPaymentError(): void;
  onFatal(): void;
}
