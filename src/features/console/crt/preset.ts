/**
 * newpixie-crt, WebGL1 / GLSL ES 1.00 edition.
 *
 * The reference implementation (psflix's `worker/gl/crt-shader.ts`) is a
 * four-pass chain. This build of RetroArch runs on a WebGL1 context and its
 * shader render targets use an unsupported format, so every non-final pass
 * fails and only a single pass can render. This module therefore ports the
 * composite pass only:
 *
 *   accumulate + blur buffers  ->  the emulator frame, plus a 5-tap blur
 *                                  sampled inline for the ghost halo
 *   curvature (0 in the tuned) ->  omitted
 *   bezel / interference       ->  omitted
 *
 * Everything that is a per-pixel function of one frame is kept verbatim, with
 * the tuned numbers below interpolated into the source so the look lives in one
 * place. See openspec/changes/player-crt-shader/design.md.
 */

/** Fixed output buffer. The effect's scanline count follows this height. */
export const CRT_OUTPUT = { width: 1440, height: 960 } as const;

/** Name of the preset written into the emulator's virtual filesystem. */
export const CRT_PRESET_NAME = 'newpixie-crt';

/** Shader directory inside the emulator's bundled RetroArch tree. */
export const SHADER_FS_DIR = '/home/web_user/retroarch/bundle/shaders/shaders_glsl';
/** RetroArch's config directory, where the global preset reference lives. */
export const SHADER_CONFIG_DIR = '/home/web_user/retroarch/userdata/config';

/** The slice of the Emscripten FS this module needs. */
export interface PresetFileSystem {
  writeFile(path: string, data: string): void;
  mkdirTree?(path: string): void;
}

/**
 * Tuned look (psflix's defaults, minus the terms that needed other passes).
 * Changing one of these changes the picture: update the spec too.
 */
export const CRT_PARAMS = {
  vignette: 0.35,
  ghosting: 0.3,
  scanlineStrength: 1.0,
  filmicToe: 0.013,
  filmicShoulder: 5.6,
  gamma: 1.18,
  /** Horizontal beam-blur step, in 1440x960 frame pixels. */
  blurX: 6.0,
  /** Vertical beam-blur step, in 1440x960 frame pixels. */
  blurY: 2.5,
} as const;

/** Mutable shape of the tuned values, for user overrides. */
export type CrtParams = { [K in keyof typeof CRT_PARAMS]: number };

function f(value: number): string {
  return value.toFixed(3);
}

export interface ShaderOptions {
  /**
   * Freeze the time-varying terms. Chosen at launch when the user prefers
   * reduced motion; RetroArch has no runtime uniform override for this.
   */
  still?: boolean;
  /** Resolved shader values. Defaults to the reference look. */
  params?: CrtParams;
}

export function buildShaderSource({ still = false, params = CRT_PARAMS }: ShaderOptions = {}): string {
  return `#ifdef VERTEX
attribute vec4 VertexCoord;
attribute vec4 TexCoord;
uniform mat4 MVPMatrix;
varying vec2 tex_coord;

void main() {
  gl_Position = MVPMatrix * VertexCoord;
  tex_coord = TexCoord.xy;
}
#endif

#ifdef FRAGMENT
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

varying vec2 tex_coord;
uniform sampler2D Texture;
uniform vec2 OutputSize;
uniform vec2 InputSize;
uniform vec2 TextureSize;
uniform int FrameCount;

#define VIGNETTE ${f(params.vignette)}
#define GHOSTING ${f(params.ghosting)}
#define SCANLINE_STRENGTH ${f(params.scanlineStrength)}
#define FILMIC_TOE ${f(params.filmicToe)}
#define FILMIC_SHOULDER ${f(params.filmicShoulder)}
#define GAMMA ${f(params.gamma)}
#define BLUR_X ${f(params.blurX)}
#define BLUR_Y ${f(params.blurY)}
#define FRAME_WIDTH ${f(CRT_OUTPUT.width)}
#define FRAME_HEIGHT ${f(CRT_OUTPUT.height)}
#define TIME_SCALE ${still ? '0.000' : '1.000'}

float rand(vec2 co) {
  return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
}

// The emulator pads the core frame into a larger texture, so the vertex
// varying only spans InputSize / TextureSize of the texture. Everything below
// works in frame-relative 0..1 coordinates ("uv"), and tex() maps back.
//
// Linearised sample with the reference's 1.25 gain.
vec3 tex(vec2 uv, vec2 span) {
  return pow(abs(texture2D(Texture, uv * span).rgb), vec3(2.2)) * vec3(1.25);
}

// Inline anisotropic beam blur. The reference reads a pre-blurred buffer
// here; the horizontal step is larger than the vertical one so the picture
// softens along the beam without washing out the scanlines. The radii are in
// fixed-frame pixels, so they do not follow the output surface.
vec3 tex_blurred(vec2 uv, vec2 span) {
  vec2 d = vec2(BLUR_X / FRAME_WIDTH, BLUR_Y / FRAME_HEIGHT);
  vec3 sum = tex(uv, span) * 2.0;
  sum += tex(uv + vec2(d.x, 0.0), span);
  sum += tex(uv - vec2(d.x, 0.0), span);
  sum += (tex(uv + vec2(0.0, d.y), span) + tex(uv - vec2(0.0, d.y), span)) * 0.5;
  return sum * 0.2;
}

void main() {
  vec2 span = max(InputSize / TextureSize, vec2(0.0001));
  vec2 uv = tex_coord / span;
  // One scanline period per emulated source line: 224 NTSC, 239 PAL, 448
  // hi-res. Anchored to the frame, never to the output surface.
  float lines = max(InputSize.y, 1.0);
  float time = mod(float(FrameCount) * TIME_SCALE, 640.0);

  // Per-scanline horizontal jitter from the reference (its "bleed" term),
  // expressed in frame units.
  float x = sin(uv.y * lines * 6.2831853) / FRAME_WIDTH * 0.25;

  vec3 col;
  col.r = tex_blurred(vec2(x + uv.x + 0.0009, uv.y + 0.0009), span).x + 0.02;
  col.g = tex_blurred(vec2(x + uv.x + 0.0000, uv.y - 0.0011), span).y + 0.02;
  col.b = tex_blurred(vec2(x + uv.x - 0.0015, uv.y + 0.0000), span).z + 0.02;

  float i = clamp(col.r * 0.299 + col.g * 0.587 + col.b * 0.114, 0.0, 1.0);
  i = pow(1.0 - pow(i, 2.0), 1.0);
  i = (1.0 - i) * 0.85 + 0.15;

  float ghs = 0.15 * GHOSTING;
  vec3 r = tex_blurred(vec2(x - 0.014, -0.027) * 0.85 + 0.007 * vec2(
            0.35 * sin(1.0 / 7.0 + 15.0 * uv.y + 0.9 * time),
            0.35 * sin(2.0 / 7.0 + 10.0 * uv.y + 1.37 * time))
          + vec2(uv.x + 0.001, uv.y + 0.001), span) * vec3(0.5, 0.25, 0.25);
  vec3 g = tex_blurred(vec2(x - 0.019, -0.020) * 0.85 + 0.007 * vec2(
            0.35 * cos(1.0 / 9.0 + 15.0 * uv.y + 0.5 * time),
            0.35 * sin(2.0 / 9.0 + 10.0 * uv.y + 1.50 * time))
          + vec2(uv.x + 0.000, uv.y - 0.002), span) * vec3(0.25, 0.5, 0.25);
  vec3 b = tex_blurred(vec2(x - 0.017, -0.003) * 0.85 + 0.007 * vec2(
            0.35 * sin(2.0 / 3.0 + 15.0 * uv.y + 0.7 * time),
            0.35 * cos(2.0 / 3.0 + 10.0 * uv.y + 1.63 * time))
          + vec2(uv.x - 0.002, uv.y + 0.000), span) * vec3(0.25, 0.25, 0.5);

  col += vec3(ghs * (1.0 - 0.299)) * pow(clamp(vec3(3.0) * r, 0.0, 1.0), vec3(2.0)) * vec3(i);
  col += vec3(ghs * (1.0 - 0.587)) * pow(clamp(vec3(3.0) * g, 0.0, 1.0), vec3(2.0)) * vec3(i);
  col += vec3(ghs * (1.0 - 0.114)) * pow(clamp(vec3(3.0) * b, 0.0, 1.0), vec3(2.0)) * vec3(i);

  col *= vec3(0.95, 1.05, 0.95);
  col = clamp(col * 1.3 + 0.75 * col * col + 1.25 * col * col * col * col * col, 0.0, 10.0);

  // No curvature, so the reference's curved coordinates collapse to uv.
  float vig = (1.0 - 0.99 * VIGNETTE) + 16.0 * uv.x * uv.y * (1.0 - uv.x) * (1.0 - uv.y);
  vig = 1.3 * sqrt(max(vig, 0.0));
  col *= vig;

  float phase = uv.y * lines * 6.2831853;
  float scans = clamp(
    1.0 - SCANLINE_STRENGTH * (0.65 - 0.18 * sin(6.0 * time - phase)),
    0.0, 1.0);
  col *= pow(scans, 0.9);

  col *= 1.0 - 0.23 * clamp(mod(uv.x * FRAME_WIDTH, 3.0) / 2.0, 0.0, 1.0);

  vec3 toe = max(vec3(0.0), col - vec3(FILMIC_TOE));
  col = (toe * (FILMIC_SHOULDER * toe + 0.5)) / (toe * (FILMIC_SHOULDER * toe + 1.7) + 0.06);

  vec2 seed = uv * OutputSize;
  col -= 0.015 * pow(
    vec3(rand(seed + time), rand(seed + time * 2.0), rand(seed + time * 3.0)),
    vec3(1.5));

  col *= 1.0 - 0.004 * (sin(50.0 * time + uv.y * 2.0) * 0.5 + 0.5);

  col = pow(max(col, vec3(0.0)), vec3(1.0 / GAMMA));
  gl_FragColor = vec4(col, 1.0);
}
#endif
`;
}

/**
 * Single-pass preset. `scale_type = viewport` keeps the only pass rendering to
 * the backbuffer: any other pass would need the render targets this build
 * cannot create.
 */
export function buildPreset(): string {
  return `shaders = 1
shader0 = shaders/${CRT_PRESET_NAME}.glsl
filter_linear0 = false
`;
}

/**
 * Writes the preset into the emulator's filesystem and points the global preset
 * at it. RetroArch loads `$CONFIG_DIR/global.glslp` when video initialises, so
 * this has to run before the core starts (Nostalgist's `beforeLaunch`).
 *
 * Returns the preset path that was referenced.
 */
export function installPreset(
  fs: PresetFileSystem,
  options: ShaderOptions = {},
): string {
  const presetPath = `${SHADER_FS_DIR}/${CRT_PRESET_NAME}.glslp`;
  for (const dir of [SHADER_FS_DIR, `${SHADER_FS_DIR}/shaders`, SHADER_CONFIG_DIR]) {
    try {
      fs.mkdirTree?.(dir);
    } catch {
      /* already present */
    }
  }
  fs.writeFile(`${SHADER_FS_DIR}/shaders/${CRT_PRESET_NAME}.glsl`, buildShaderSource(options));
  fs.writeFile(presetPath, buildPreset());
  fs.writeFile(`${SHADER_CONFIG_DIR}/global.glslp`, `#reference ${presetPath}\n`);
  return presetPath;
}
