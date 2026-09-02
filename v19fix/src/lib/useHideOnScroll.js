import { useEffect, useState } from 'react';

/**
 * Mobile controls auto-hide on iOS/other mobile browsers.
 * Android deliberately keeps the header/search controls in normal document flow
 * to avoid Chromium sticky/compositor repaint flicker while scrolling.
 */
export function useHideOnScroll() {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent || '';
    const isAndroid = /Android/i.test(ua);

    if (isAndroid) {
      document.documentElement.classList.add('android-device');
      setHidden(false);
      return () => document.documentElement.classList.remove('android-device');
    }

    let lastY = window.scrollY;
    function onScroll() {
      if (window.innerWidth > 640) { setHidden(false); return; }
      const y = window.scrollY;
      const delta = y - lastY;
      if (y < 30) setHidden(false);
      else if (delta > 6) setHidden(true);
      else if (delta < -6) setHidden(false);
      lastY = y;
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return hidden;
}
