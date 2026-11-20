/** A pointer that moved further than this between press and release was a drag, not a tap. */
export const TAP_SLOP_PX = 6;

/** Elements that act on a click themselves: a click on one is not a tap on the page. */
const INTERACTIVE_SELECTOR = 'a, button, input, textarea, select, [role="button"], [role="link"]';

export interface TapInput {
  /** The element the click landed on (null when unknown). */
  target: { closest?: (selector: string) => unknown } | null;
  /** Where the pointer went down and where the click happened, in client pixels. */
  down: { x: number; y: number } | null;
  up: { x: number; y: number };
  /** The text selected in the page when the click happened. */
  selectedText: string;
  /** Command, Control, Shift or Alt held: a modified click is not a plain tap. */
  modified: boolean;
}

/**
 * Whether a click on the web reader's page counts as the tap that shows or
 * hides the bars. Links (the PDF's own annotation links) keep their job, a
 * drag that selected text or panned the page is not a tap, and neither is a
 * modified click.
 */
export function isPageTap({ target, down, up, selectedText, modified }: TapInput): boolean {
  if (modified) return false;
  if (selectedText.trim().length > 0) return false;
  if (target?.closest?.(INTERACTIVE_SELECTOR)) return false;
  if (down && Math.hypot(up.x - down.x, up.y - down.y) > TAP_SLOP_PX) return false;
  return true;
}
