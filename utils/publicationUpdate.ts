import type { Publication } from '@/types';

/** What the device knows about the PDF it keeps for a publication. */
export interface CachedPublicationFile {
  version: string | null;
  /** Null for copies cached before the server sent fingerprints. */
  fingerprint: string | null;
  /** The publication's updatedAt when the file was downloaded. */
  updatedAt: string;
}

/**
 * Whether the server has a newer PDF than the cached copy.
 *
 * The file fingerprint changes whenever the PDF is replaced, even under the
 * same printed version (a corrected file usually keeps "v1.0"). `newVersion`
 * is set only when the version label itself changed, so the banner shows a
 * label only when there is a new one to show.
 */
export function publicationUpdate(
  cached: CachedPublicationFile,
  publication: Pick<Publication, 'version' | 'pdfFingerprint' | 'updatedAt'>,
): { available: boolean; newVersion: string | null } {
  const versionChanged = !!publication.version && publication.version !== cached.version;
  let fileChanged = false;
  if (publication.pdfFingerprint) {
    // A copy from before fingerprints only knows when the publication last changed.
    fileChanged = cached.fingerprint
      ? cached.fingerprint !== publication.pdfFingerprint
      : cached.updatedAt !== publication.updatedAt;
  }
  return {
    available: versionChanged || fileChanged,
    newVersion: versionChanged ? publication.version : null,
  };
}
