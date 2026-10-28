/**
 * Contract of the platform-specific passkey client. The web implementation wraps
 * `@simplewebauthn/browser`, the native one wraps `react-native-passkey`. Both exchange the
 * standard WebAuthn JSON shapes the API produces and consumes, so passkeyService stays platform-free.
 */

/** Options as produced by the server's `generateRegistrationOptions()` / `generateAuthenticationOptions()`. */
export type PasskeyOptionsJSON = Record<string, unknown>;

/** The credential JSON the API verifies (`RegistrationResponseJSON` / `AuthenticationResponseJSON`). */
export type PasskeyCredentialJSON = Record<string, unknown>;

export interface PasskeyGetOptions {
  /** Conditional UI: offer the passkeys in the browser's autofill list instead of a modal sheet (web only). */
  autofill?: boolean;
  /** Aborts a pending request, for example an autofill request left open while the person submits a form. */
  signal?: AbortSignal;
}

export interface PasskeyClient {
  isSupported(): Promise<boolean>;
  /** Web only; always false on native. */
  supportsAutofill(): Promise<boolean>;
  create(options: PasskeyOptionsJSON): Promise<PasskeyCredentialJSON>;
  get(options: PasskeyOptionsJSON, opts?: PasskeyGetOptions): Promise<PasskeyCredentialJSON>;
  /** True when the error means the person dismissed the system sheet, or the request was aborted. */
  isCancelled(error: unknown): boolean;
  /** Human label for the key being created, e.g. "iPhone" or "Chrome on Windows". */
  defaultName(): string;
}
