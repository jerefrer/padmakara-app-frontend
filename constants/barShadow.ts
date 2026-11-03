/**
 * Top shadow of the bottom bar stack (player bar, tab bar). Only the highest
 * bar carries it: the stack reads as one block over the content, and a
 * hairline separates the bars inside it.
 *
 * `boxShadow` rather than shadow* + elevation: elevation is the only shadow
 * Android had, a wider grey Material shadow that never matched iOS. Under the
 * New Architecture boxShadow renders the same blur on iOS, Android and web.
 */
export const BAR_TOP_SHADOW = { boxShadow: '0px -2px 8px rgba(0, 0, 0, 0.12)' } as const;
