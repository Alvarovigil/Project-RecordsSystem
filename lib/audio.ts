/**
 * Playable source for a preview URL.
 *
 * Local files (/previews/*.mp3) are served as-is. Remote iTunes previews go
 * through /api/preview, which re-labels Apple's `audio/x-m4p` content type as
 * `audio/mp4` — browsers refuse to decode the original one, so without this
 * the preview is silent.
 */
export function previewSrc(url: string): string {
  if (!/^https?:/i.test(url)) return url;
  return `/api/preview?url=${encodeURIComponent(url)}`;
}
