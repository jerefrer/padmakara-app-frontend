/**
 * Shared geometry for content screens on mobile.
 *
 * Text and list thumbnails are indented by TEXT_GUTTER. Lines (section rules
 * and row separators) run from the left screen edge to RULE_RIGHT_INSET before
 * the right edge: the same gutter as the text, so a row never stops short of
 * its own padding.
 *
 * Only two kinds of horizontal line exist app-wide:
 * - RULE_COLOR, light red: directly under a section header or page title;
 * - SUBDIVISION_COLOR, light black: every separator between rows.
 * Never write a line colour inline: use one of these two.
 */
import { Platform, StyleSheet } from "react-native";

/** Side of a list picture: the Personal Library's round group pictures and the square thumbnails. */
export const LIST_AVATAR_SIZE = 80;

/** Left/right indent of text and list thumbnails on mobile. */
export const TEXT_GUTTER = 24;

/** Lines start at the text's left edge (the content edge), not at the screen edge. */
export const RULE_LEFT_INSET = TEXT_GUTTER;

/**
 * Lines stop this far before the right edge: the text gutter, mirroring the left padding.
 * (It used to be TEXT_GUTTER + 12, which left phone lines ending ~35pt short of the edge while
 * the header image ran full width.)
 */
export const RULE_RIGHT_INSET = TEXT_GUTTER;

/**
 * Thickness of the red section rules. On the web a full 1px is two device pixels on a
 * high-density screen and reads heavier than the sidebar dividers (SUBDIVISION_THICKNESS),
 * so the web draws the same half-pixel hairline.
 */
export const RULE_THICKNESS = Platform.OS === "web" ? 0.5 : 1;

/** Light red: the line under a section header or page title (burgundy at about half strength). */
export const RULE_COLOR = "rgba(155,27,27,0.5)";

/** Light black: the line between rows (black at 15%), the same on every screen. */
export const SUBDIVISION_COLOR = "rgba(0,0,0,0.15)";

/**
 * Weight of the thin lines between rows. On the web hairlineWidth is a full 1px, which
 * reads as a heavy black bar; half a pixel draws a true hairline on high-density screens.
 */
export const SUBDIVISION_THICKNESS = Platform.OS === "web" ? 0.5 : StyleSheet.hairlineWidth;

/**
 * Widest the whole desktop app grows (André: about 300 px sidebar, 700 px content, 200 px red
 * panel, "the largest that we go ever"): the 280 px sidebar, a 700 px central column and the
 * 220 px right panel, 1200 px. The sidebar, content, panel and player bar form one contiguous
 * block, centred; beyond this width the extra space is light grey outside it, on both sides,
 * never between its parts. It also keeps header pictures from stretching past their size here.
 */
export const DESKTOP_APP_MAX_WIDTH = 1200;

/**
 * Desktop pictures are square, text beside them (André): the home highlight and the event
 * header. They take 45% of the column up to this size, so a wide screen does not push the
 * content below them out of sight.
 */
export const DESKTOP_SQUARE_MAX = 480;
