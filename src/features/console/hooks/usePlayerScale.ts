import { useLayoutEffect } from 'react';
import type { RefObject } from 'react';
import { emulatorService } from '../services';
import { CRT_OUTPUT } from '../crt/preset';
import { fitStage, NATIVE_FRAME, selectRenderScale } from '../scaling';

/**
 * Fits the 4:3 stage inside the player surface and keeps the emulator's
 * drawing buffer honest.
 *
 * With CRT on, the buffer is the effect's fixed output frame (1440x960) and the
 * canvas simply fills the stage: the shader's scanline count must not depend on
 * the window. With CRT off, the buffer stays a whole-pixel multiple of the SNES
 * frame and a CSS transform performs the smooth fractional fit.
 */
export function usePlayerScale(
  surfaceRef: RefObject<HTMLElement | null>,
  stageRef: RefObject<HTMLElement | null>,
  canvasRef: RefObject<HTMLCanvasElement | null>,
  crt = true,
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

      // Emulator's canvas buffer follows the element's CSS box, so the box is
      // the buffer size and the transform performs the fit.
      const scale = selectRenderScale(fitted.width, fitted.height, window.devicePixelRatio || 1);
      const width = crt ? CRT_OUTPUT.width : NATIVE_FRAME.width * scale;
      const height = crt ? CRT_OUTPUT.height : NATIVE_FRAME.height * scale;

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
  }, [surfaceRef, stageRef, canvasRef, crt]);
}
