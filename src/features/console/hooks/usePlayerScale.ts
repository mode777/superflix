import { useLayoutEffect } from 'react';
import type { RefObject } from 'react';
import { emulatorService } from '../services';
import { fitStage, NATIVE_FRAME, scanlinePitch, selectRenderScale } from '../scaling';

/**
 * Fits the 4:3 stage inside the player surface and keeps the emulator's
 * drawing buffer on a whole-pixel multiple of the SNES frame.
 *
 * The canvas's *layout* box is kept at the buffer size because the core sizes
 * its drawing buffer from that box; a CSS transform then performs the smooth
 * fractional fit. Sizes are written straight to the DOM so continuous resizing
 * does not re-render the controls.
 */
export function usePlayerScale(
  surfaceRef: RefObject<HTMLElement | null>,
  stageRef: RefObject<HTMLElement | null>,
  canvasRef: RefObject<HTMLCanvasElement | null>,
): void {
  useLayoutEffect(() => {
    const surface = surfaceRef.current;
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    if (!surface || !stage || !canvas) return;

    let frame: number | null = null;
    let observer: ResizeObserver | null = null;
    let media: MediaQueryList | null = null;
    let lastSize = '';

    const update = () => {
      const rect = surface.getBoundingClientRect();
      const fitted = fitStage(rect.width, rect.height);
      if (fitted.width <= 0 || fitted.height <= 0) return;

      stage.style.width = `${fitted.width}px`;
      stage.style.height = `${fitted.height}px`;
      stage.style.setProperty('--crt-line-pitch', `${scanlinePitch(fitted.height)}px`);

      const scale = selectRenderScale(fitted.width, fitted.height, window.devicePixelRatio || 1);
      const width = NATIVE_FRAME.width * scale;
      const height = NATIVE_FRAME.height * scale;

      // Keep the measured box integral; the transform does the soft remainder.
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      canvas.style.transformOrigin = 'top left';
      canvas.style.transform = `scale(${fitted.width / width}, ${fitted.height / height})`;
      canvas.style.imageRendering = 'auto';

      const size = `${width}x${height}`;
      if (size === lastSize) return;
      lastSize = size;
      emulatorService.resizeVideo(width, height);
    };

    const schedule = () => {
      if (frame !== null) return;
      if (typeof window.requestAnimationFrame !== 'function') {
        update();
        return;
      }
      frame = window.requestAnimationFrame(() => {
        frame = null;
        update();
      });
    };

    const onDprChange = () => {
      watchDpr();
      schedule();
    };

    const watchDpr = () => {
      if (!media) return;
      media.removeEventListener('change', onDprChange);
      media = null;
      if (typeof window.matchMedia !== 'function') return;
      media = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
      media.addEventListener('change', onDprChange);
    };

    const onResize = () => {
      watchDpr();
      schedule();
    };

    // The first measurement happens before paint so the canvas never flashes
    // at the wrong size.
    update();

    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(schedule);
      observer.observe(surface);
    }
    window.addEventListener('resize', onResize);
    document.addEventListener('fullscreenchange', schedule);
    watchDpr();

    return () => {
      if (frame !== null && typeof window.cancelAnimationFrame === 'function') {
        window.cancelAnimationFrame(frame);
      }
      observer?.disconnect();
      window.removeEventListener('resize', onResize);
      document.removeEventListener('fullscreenchange', schedule);
      media?.removeEventListener('change', onDprChange);
    };
  }, [surfaceRef, stageRef, canvasRef]);
}
