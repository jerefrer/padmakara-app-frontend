export interface EasypayCheckoutProps {
  manifest: { id: string; session: string };
  testing: boolean;
  language: 'en' | 'pt';
  onSuccess(): void;
  onClose(): void;
  onPaymentError(): void;
  onFatal(): void;
}
