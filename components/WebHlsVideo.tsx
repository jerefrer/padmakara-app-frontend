import { forwardRef } from 'react';
import type { WebHlsVideoProps, WebPlayerHandle } from './WebHlsVideo.types';

/**
 * Native / default stub. The real implementation lives in `WebHlsVideo.web.tsx`
 * and is only ever rendered on web (VideoPlayer gates on `Platform.OS`). This
 * stub keeps `hls.js` out of the native bundle and gives `tsc` a module to
 * resolve `./WebHlsVideo` against — it renders nothing.
 */
export const WebHlsVideo = forwardRef<WebPlayerHandle, WebHlsVideoProps>(
  function WebHlsVideo(_props, _ref) {
    return null;
  },
);

export default WebHlsVideo;
