// Fallback for TypeScript and tooling. Metro and Jest pick passkeyClient.web.ts or
// passkeyClient.native.ts per platform before reaching this file.
export { default } from './passkeyClient.native';
