/**
 * Shared geometry for content screens on mobile.
 *
 * Text and list thumbnails are indented by TEXT_GUTTER. Horizontal lines
 * (section rules and row separators) start at the left screen edge and stop
 * RULE_RIGHT_INSET before the right edge, a bit earlier than the text gutter.
 */

/** Left/right indent of text and list thumbnails on mobile. */
export const TEXT_GUTTER = 24;

/** Lines run from the left edge and stop this far before the right edge. */
export const RULE_RIGHT_INSET = TEXT_GUTTER + 12;

/** Thickness of the red section rules. */
export const RULE_THICKNESS = 1;
