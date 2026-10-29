import { describe, expect, it } from 'vitest';
import {
  CRT_OUTPUT,
  CRT_PARAMS,
  CRT_PRESET_NAME,
  buildPreset,
  buildShaderSource,
} from './preset';

describe('CRT reference parameters', () => {
  it('pins the tuned look', () => {
    expect(CRT_PARAMS).toEqual({
      vignette: 0.35,
      ghosting: 0.3,
      scanlineStrength: 1.0,
      filmicToe: 0.013,
      filmicShoulder: 5.6,
      gamma: 1.18,
      ghostBlur: 4.0,
    });
  });

  it('keeps the reference output frame', () => {
    expect(CRT_OUTPUT).toEqual({ width: 1440, height: 960 });
  });
});

describe('buildShaderSource', () => {
  it('carries both shader stages', () => {
    const source = buildShaderSource();
    expect(source).toContain('#ifdef VERTEX');
    expect(source).toContain('#ifdef FRAGMENT');
    expect(source).toContain('gl_FragColor');
    expect(source).toContain('texture2D(Texture');
  });

  it('bakes the tuned values into the source', () => {
    const source = buildShaderSource();
    expect(source).toContain('#define VIGNETTE 0.350');
    expect(source).toContain('#define GHOSTING 0.300');
    expect(source).toContain('#define SCANLINE_STRENGTH 1.000');
    expect(source).toContain('#define FILMIC_TOE 0.013');
    expect(source).toContain('#define FILMIC_SHOULDER 5.600');
    expect(source).toContain('#define GAMMA 1.180');
  });

  it('runs a single pass: no feedback or previous-pass inputs', () => {
    const source = buildShaderSource();
    expect(source).not.toContain('Feedback');
    expect(source).not.toContain('PassPrev');
    expect(source).not.toContain('fragColor1');
  });

  it('freezes its time-varying terms in the still variant', () => {
    expect(buildShaderSource()).toContain('#define TIME_SCALE 1.000');
    expect(buildShaderSource({ still: true })).toContain('#define TIME_SCALE 0.000');
  });
});

describe('buildPreset', () => {
  it('describes one viewport-scaled pass, so no render target is needed', () => {
    const preset = buildPreset();
    expect(preset).toContain('shaders = 1');
    expect(preset).toContain(`shader0 = shaders/${CRT_PRESET_NAME}.glsl`);
    expect(preset).not.toContain('feedback_pass');
    expect(preset).not.toContain('shader1');
  });
});
