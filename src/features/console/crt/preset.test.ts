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
      blurX: 6.0,
      blurY: 2.5,
    });
  });

  it('keeps the reference output frame', () => {
    expect(CRT_OUTPUT).toEqual({ width: 1440, height: 960 });
  });

  it('blurs more horizontally than vertically', () => {
    expect(CRT_PARAMS.blurX).toBeGreaterThan(CRT_PARAMS.blurY);
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
    expect(source).toContain('#define BLUR_X 6.000');
    expect(source).toContain('#define BLUR_Y 2.500');
    expect(source).toContain('#define FRAME_WIDTH 1440.000');
    expect(source).toContain('#define FRAME_HEIGHT 960.000');
  });

  it('normalises the padded texture varying to frame coordinates', () => {
    const source = buildShaderSource();
    // The emulator pads the frame into a larger texture, so tex_coord only
    // spans InputSize / TextureSize; screen-space math must undo that.
    expect(source).toContain('uniform vec2 InputSize;');
    expect(source).toContain('uniform vec2 TextureSize;');
    expect(source).toContain('vec2 span = max(InputSize / TextureSize, vec2(0.0001));');
    expect(source).toContain('vec2 uv = tex_coord / span;');
    expect(source).toContain('texture2D(Texture, uv * span)');
  });

  it('anchors the scanline pitch to the source line count', () => {
    const source = buildShaderSource();
    expect(source).toContain('float lines = max(InputSize.y, 1.0);');
    expect(source).toContain('float phase = uv.y * lines * 6.2831853;');
    expect(source).toContain('sin(6.0 * time - phase)');
    expect(source).not.toContain('uv.y * OutputSize.y');
  });

  it('expresses mask, jitter and blur in frame units', () => {
    const source = buildShaderSource();
    expect(source).toContain('mod(uv.x * FRAME_WIDTH, 3.0)');
    expect(source).toContain('sin(uv.y * lines * 6.2831853) / FRAME_WIDTH');
    expect(source).toContain('vec2 d = vec2(BLUR_X / FRAME_WIDTH, BLUR_Y / FRAME_HEIGHT);');
    expect(source).not.toContain('gl_FragCoord');
    expect(source).not.toContain('OutputSize.x');
    expect(source).not.toContain('OutputSize.y');
    // Grain is intentionally output-resolution noise.
    expect(source).toContain('vec2 seed = uv * OutputSize;');
  });

  it('blurs the base colour and the ghost halo with the anisotropic kernel', () => {
    const source = buildShaderSource();
    expect(source).toContain('col.r = tex_blurred(');
    expect(source).toContain('col.g = tex_blurred(');
    expect(source).toContain('col.b = tex_blurred(');
    expect(source).toContain('vec3 r = tex_blurred(');
    expect(source).toContain('vec3 g = tex_blurred(');
    expect(source).toContain('vec3 b = tex_blurred(');
    expect(source).toContain('sum * 0.2');
    expect(source).not.toContain('GHOST_BLUR');
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
