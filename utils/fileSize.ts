/**
 * Format bytes into human readable file size string
 * @param bytes - File size in bytes
 * @param decimals - Number of decimal places (default: 1)
 * @returns Formatted file size string (e.g., "23.5 MB", "1.2 GB")
 */
export function formatBytes(bytes: number, decimals: number = 1): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  const value = bytes / Math.pow(k, i);
  const formattedValue = decimals === 0 ? Math.round(value) : parseFloat(value.toFixed(decimals));
  
  return `${formattedValue} ${sizes[i]}`;
}

/**
 * Estimate audio file size based on duration and quality
 * @param durationSeconds - Audio duration in seconds  
 * @param qualityKbps - Audio bitrate in kbps (default: 128 for good quality)
 * @returns Estimated file size in bytes
 */
export function estimateAudioFileSize(durationSeconds: number, qualityKbps: number = 128): number {
  // Formula: (bitrate in bits per second * duration) / 8 bits per byte
  const bitsPerSecond = qualityKbps * 1024;
  const totalBits = bitsPerSecond * durationSeconds;
  return Math.round(totalBits / 8);
}