/**
 * Whether the server will stamp a PDF with the reader's name and email.
 * Mirrors padmakara-api/src/routes/media.ts:
 *  - transcripts: watermarked for any signed-in reader unless the parent
 *    event is public (`free-anyone`). An event with no audience data is not
 *    public, so it is watermarked too.
 *  - event files: watermarked when the file is a PDF flagged `sensitive`.
 *    Files always require a signed-in reader.
 * Publications are not watermarked.
 */

export const PUBLIC_AUDIENCE_SLUG = 'free-anyone';

export function willWatermarkTranscript(args: {
  isAuthenticated: boolean;
  audienceSlug?: string | null;
}): boolean {
  return args.isAuthenticated && args.audienceSlug !== PUBLIC_AUDIENCE_SLUG;
}

export function willWatermarkFile(args: {
  isAuthenticated: boolean;
  sensitive?: boolean;
  extension?: string | null;
}): boolean {
  const isPdf = (args.extension ?? '').replace(/^\./, '').toLowerCase() === 'pdf';
  return args.isAuthenticated && !!args.sensitive && isPdf;
}
