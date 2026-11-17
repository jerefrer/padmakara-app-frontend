/**
 * Web only: saves the file at `url` (an https or blob: URL) under `filename`
 * through a temporary download link. The bytes are fetched first so the name
 * applies even to cross-origin URLs, where the `download` attribute alone is
 * ignored. Throws when the file cannot be fetched.
 */
export async function downloadFileWeb(url: string, filename: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download failed: ${response.status}`);
  const objectUrl = URL.createObjectURL(await response.blob());
  try {
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
