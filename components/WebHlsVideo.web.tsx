import Hls from 'hls.js';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { pickPreferredSubtitle } from '@/utils/subtitlePreference';
import type { WebHlsVideoProps, WebPlayerHandle } from './WebHlsVideo.types';

/**
 * Native HLS (Safari / iOS web): enable the preferred subtitle TextTrack.
 * hls.js is used on every desktop browser with MSE, so this path is only hit
 * by mobile Safari where the media engine parses the renditions itself.
 */
function enableNativeTextTrack(
  video: HTMLVideoElement,
  contentLanguage: string,
  uiLanguage: string,
): void {
  const subs = Array.from(video.textTracks).filter(
    (t) => t.kind === 'subtitles' || t.kind === 'captions',
  );
  if (subs.length === 0) return;
  const preferred = pickPreferredSubtitle(
    subs.map((t, index) => ({ index, language: t.language ?? '' })),
    contentLanguage,
    uiLanguage,
  );
  if (!preferred) return;
  subs.forEach((t, i) => {
    t.mode = i === preferred.index ? 'showing' : 'disabled';
  });
}

/**
 * Web video player backed by hls.js. expo-video's web player renders a plain
 * `<video src=m3u8>` with no HLS engine and no subtitle support, so on web we
 * render our own element: hls.js gives us HLS on Chrome/Firefox and surfaces
 * the manifest's subtitle renditions in the native CC menu, defaulting the
 * preferred language on. Playback state is exposed to the parent through a
 * `WebPlayerHandle` ref so the existing progress/resume/close logic is reused.
 */
export const WebHlsVideo = forwardRef<WebPlayerHandle, WebHlsVideoProps>(
  function WebHlsVideo(props, ref) {
    const { uri, onTimeUpdate } = props;
    const videoRef = useRef<HTMLVideoElement | null>(null);
    // Latest props for the load effect, so a late resume value or language
    // change never re-triggers it (it is keyed on `uri` only).
    const propsRef = useRef(props);
    propsRef.current = props;

    useImperativeHandle(
      ref,
      () => ({
        play: () => {
          videoRef.current?.play().catch(() => undefined);
        },
        pause: () => videoRef.current?.pause(),
        seek: (seconds) => {
          if (videoRef.current) videoRef.current.currentTime = seconds;
        },
        getCurrentTime: () => videoRef.current?.currentTime ?? 0,
        getDuration: () => videoRef.current?.duration ?? 0,
      }),
      [],
    );

    // Report progress on every timeupdate; the parent throttles the saves.
    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;
      const handler = () => onTimeUpdate(video.currentTime);
      video.addEventListener('timeupdate', handler);
      return () => video.removeEventListener('timeupdate', handler);
    }, [onTimeUpdate]);

    // Load HLS and enable the preferred subtitle track. Keyed on `uri` only.
    useEffect(() => {
      const video = videoRef.current;
      if (!video || !uri) return;

      const applyResumeAndPlay = () => {
        const { resumePosition } = propsRef.current;
        if (resumePosition > 0) {
          try {
            video.currentTime = resumePosition;
          } catch {
            // A seek before the media is seekable is harmless to ignore.
          }
        }
        video.play().catch(() => undefined);
      };

      if (Hls.isSupported()) {
        const hls = new Hls();
        hls.loadSource(uri);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, applyResumeAndPlay);
        hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, () => {
          const { contentLanguage, uiLanguage } = propsRef.current;
          const preferred = pickPreferredSubtitle(
            hls.subtitleTracks.map((t, index) => ({
              index,
              language: t.lang ?? t.name ?? '',
            })),
            contentLanguage,
            uiLanguage,
          );
          if (preferred) {
            hls.subtitleTrack = preferred.index;
            hls.subtitleDisplay = true;
          }
        });
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) propsRef.current.onError();
        });
        return () => hls.destroy();
      }

      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Safari / iOS web — native HLS including subtitle renditions.
        video.src = uri;
        const onMeta = () => {
          applyResumeAndPlay();
          const { contentLanguage, uiLanguage } = propsRef.current;
          enableNativeTextTrack(video, contentLanguage, uiLanguage);
        };
        const onErr = () => propsRef.current.onError();
        const onAddTrack = () => {
          const { contentLanguage, uiLanguage } = propsRef.current;
          enableNativeTextTrack(video, contentLanguage, uiLanguage);
        };
        video.addEventListener('loadedmetadata', onMeta);
        video.addEventListener('error', onErr);
        video.textTracks.addEventListener('addtrack', onAddTrack);
        return () => {
          video.removeEventListener('loadedmetadata', onMeta);
          video.removeEventListener('error', onErr);
          video.textTracks.removeEventListener('addtrack', onAddTrack);
          video.removeAttribute('src');
          video.load();
        };
      }

      propsRef.current.onError();
      return undefined;
    }, [uri]);

    return (
      <video
        ref={videoRef}
        controls
        playsInline
        crossOrigin="anonymous"
        style={{ width: '100%', height: '100%', backgroundColor: '#000', objectFit: 'contain' }}
      />
    );
  },
);

export default WebHlsVideo;
