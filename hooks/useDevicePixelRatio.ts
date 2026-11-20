import { useEffect, useState } from 'react';

function currentRatio(): number {
  return (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
}

/**
 * The browser's current devicePixelRatio, kept up to date. The ratio changes
 * while a page is open when the window moves to another display (a Retina
 * laptop and an external monitor), when the browser zoom changes, and when the
 * display scaling does; a canvas drawn for the old ratio is then upscaled or
 * downscaled by the browser and looks soft. Web only; 1 elsewhere.
 */
export function useDevicePixelRatio(): number {
  const [ratio, setRatio] = useState(currentRatio);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let query: MediaQueryList | null = null;
    const refresh = () => setRatio(currentRatio());
    // A `resolution` query only fires when the ratio leaves its current value,
    // so it is armed again for the new one after every change.
    const arm = () => {
      query?.removeEventListener('change', onChange);
      if (typeof window.matchMedia !== 'function') return;
      query = window.matchMedia(`(resolution: ${currentRatio()}dppx)`);
      query.addEventListener('change', onChange);
    };
    const onChange = () => {
      refresh();
      arm();
    };
    refresh();
    arm();
    window.addEventListener('resize', refresh);
    return () => {
      query?.removeEventListener('change', onChange);
      window.removeEventListener('resize', refresh);
    };
  }, []);

  return ratio;
}
