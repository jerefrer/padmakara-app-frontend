/**
 * Shared geometry for content screens on mobile.
 *
 * Text and list thumbnails are indented by TEXT_GUTTER. Horizontal lines
 * (section rules and row separators) start at the left screen edge and stop
 * RULE_RIGHT_INSET before the right edge, a bit earlier than the text gutter.
 *
 * Line hierarchy: ONE red rule at the top of a list or section (right under
 * the page header, see components/ui/SectionRule.tsx), and thin dark
 * hairlines between rows (the subdivisions).
 */
import { Platform, StyleSheet } from "react-native";

/** Left/right indent of text and list thumbnails on mobile. */
export const TEXT_GUTTER = 24;

/** Lines run from the left edge and stop this far before the right edge. */
export const RULE_RIGHT_INSET = TEXT_GUTTER + 12;

/**
 * Thickness of the red section rules. On the web a full 1px is two device pixels on a
 * high-density screen and reads heavier than the sidebar dividers (SUBDIVISION_THICKNESS),
 * so the web draws the same half-pixel hairline.
 */
export const RULE_THICKNESS = Platform.OS === "web" ? 0.5 : 1;

/** Colour of the red rule at the top of a list or section (burgundy). */
export const RULE_COLOR = "#9b1b1b";

/** Colour of the thin lines between rows: near-black, kept light by the hairline weight. */
export const SUBDIVISION_COLOR = "#2c2c2c";

/**
 * Weight of the thin lines between rows. On the web hairlineWidth is a full 1px, which
 * reads as a heavy black bar; half a pixel draws a true hairline on high-density screens.
 */
export const SUBDIVISION_THICKNESS = Platform.OS === "web" ? 0.5 : StyleSheet.hairlineWidth;

/**
 * Desktop pictures are square, text beside them (André): the home highlight and the event
 * header. They take 45% of the column up to this size, so a wide screen does not push the
 * content below them out of sight.
 */
export const DESKTOP_SQUARE_MAX = 480;
