import { renderHook } from '@testing-library/react';
import type { RefObject } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ resizeVideo: vi.fn() }));

vi.mock('../services', () => ({
  emulatorService: { resizeVideo: h.resizeVideo },
}));

const { usePlayerScale } = await import('./usePlayerScale');

function createSurface(width: number, height: number) {
  const surface = document.createElement('div');
  surface.getBoundingClientRect = () =>
    ({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: width,
      bottom: height,
      width,
      height,
      toJSON: () => ({}),
    }) as DOMRect;
  return surface;
}

function setup(surfaceWidth: number, surfaceHeight: number, crt = false) {
  const surface = createSurface(surfaceWidth, surfaceHeight);
  const stage = document.createElement('div');
  const canvas = document.createElement('canvas');
  const surfaceRef = { current: surface } as RefObject<HTMLDivElement>;
  const stageRef = { current: stage } as RefObject<HTMLDivElement>;
  const canvasRef = { current: canvas } as RefObject<HTMLCanvasElement>;

  const view = renderHook(() => usePlayerScale(surfaceRef, stageRef, canvasRef, crt));
  return { ...view, surface, stage, canvas };
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(() => resolve());
    } else {
      window.setTimeout(resolve, 0);
    }
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('usePlayerScale', () => {
  it('fits the stage to 4:3 and keeps the canvas box at a whole-pixel buffer', () => {
    const { stage, canvas } = setup(1312, 738);

    expect(stage.style.width).toBe('984px');
    expect(stage.style.height).toBe('738px');
    // n = 3: the drawing-buffer box stays 768x672 and is transformed to fill.
    expect(canvas.style.width).toBe('768px');
    expect(canvas.style.height).toBe('672px');
    expect(canvas.style.transform).toBe(`scale(${984 / 768}, ${738 / 672})`);
    expect(canvas.style.imageRendering).toBe('auto');

    expect(h.resizeVideo).toHaveBeenCalledTimes(1);
    expect(h.resizeVideo).toHaveBeenCalledWith(768, 672);
  });

  it('does not request a second buffer when the size has not changed', async () => {
    setup(1312, 738);

    window.dispatchEvent(new Event('resize'));
    await nextFrame();

    expect(h.resizeVideo).toHaveBeenCalledTimes(1);
  });

  it('requests a new buffer when the stage moves to another whole multiple', async () => {
    setup(1312, 738);
    const { stage, canvas } = setup(1920, 1080);

    window.dispatchEvent(new Event('resize'));
    await nextFrame();

    expect(h.resizeVideo).toHaveBeenLastCalledWith(1024, 896);
    expect(stage.style.width).toBe('1440px');
    expect(stage.style.height).toBe('1080px');
    expect(canvas.style.width).toBe('1024px');
    expect(canvas.style.height).toBe('896px');
  });

  it('uses the effect\'s fixed buffer and fills the stage while CRT is on', () => {
    const { stage, canvas } = setup(1312, 738, true);

    expect(stage.style.width).toBe('984px');
    expect(stage.style.height).toBe('738px');
    expect(canvas.style.width).toBe('1440px');
    expect(canvas.style.height).toBe('960px');
    expect(canvas.style.transform).toBe(`scale(${984 / 1440}, ${738 / 960})`);
    expect(h.resizeVideo).toHaveBeenCalledTimes(1);
    expect(h.resizeVideo).toHaveBeenCalledWith(1440, 960);
  });

  it('does nothing before the surface has been measured', () => {
    const { stage } = setup(0, 0);

    expect(stage.style.width).toBe('');
    expect(h.resizeVideo).not.toHaveBeenCalled();
  });
});
