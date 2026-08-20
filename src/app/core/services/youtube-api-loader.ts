import { Injectable } from '@angular/core';

declare global {
  interface Window {
    YT?: typeof YT;
    onYouTubeIframeAPIReady?: () => void;
  }
}

/**
 * Loads the YouTube IFrame Player API exactly once per app lifetime and
 * hands back a promise that resolves once `window.YT` is ready to use.
 * Components depend on this instead of talking to the global `window`
 * object directly, which keeps the rest of the app testable.
 */
@Injectable({ providedIn: 'root' })
export class YoutubeApiLoader {
  private readyPromise: Promise<typeof YT> | null = null;

  load(): Promise<typeof YT> {
    if (this.readyPromise) return this.readyPromise;

    this.readyPromise = new Promise<typeof YT>((resolve) => {
      if (window.YT && window.YT.Player) {
        resolve(window.YT);
        return;
      }

      const previousCallback = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        previousCallback?.();
        resolve(window.YT as typeof YT);
      };

      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(script);
    });

    return this.readyPromise;
  }
}
