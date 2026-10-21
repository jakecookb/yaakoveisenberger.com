import { curvesLut } from './curves';
import { ASPECTS, gradeFor, type Params } from './params';

// The photo editor's renderer. Every adjustment runs in one WebGL2 fragment shader, so the preview updates live and the
// export re-runs the same shader at full resolution (in tiles, so huge photos fit in graphics memory).

const VS = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

const FS = `#version 300 es
precision highp float;
uniform sampler2D uSrc, uBlur, uBlurBig, uMask, uLut;
uniform vec2 uOut, uTile; uniform bool uFlipY;
uniform vec2 uCrop; uniform mat3 uA; uniform float uK, uKNorm;
uniform float uExposure, uContrast, uHighlights, uShadows, uVibrance, uSaturation, uClarity, uSharpen, uGrain, uGrainCell, uVignette;
uniform vec3 uWB;
uniform vec3 uLift, uGamma, uGain, uShTint, uHiTint; uniform float uFade, uGSat, uGContrast; uniform bool uMono;
uniform int uBgMode; uniform vec3 uBgColor; uniform bool uHasMask; uniform float uEdge; uniform bool uBypass;
out vec4 o;

vec3 toLin(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }
vec3 toSrgb(vec3 c) { c = max(c, 0.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
float hash(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }

// Output pixel -> source texture coordinate: crop, lens (telephoto/wide) distortion, straighten, flips, quarter turns.
vec2 srcUV(vec2 uv) {
  vec2 q = (uv - 0.5) * uCrop;
  float r2 = dot(q, q) / dot(uCrop * 0.5, uCrop * 0.5);
  q *= (1.0 + uK * r2) * uKNorm;
  return (uA * vec3(q, 1.0)).xy;
}

vec3 develop(vec3 c, vec3 blur) {
  vec3 p = toSrgb(toLin(c) * exp2(uExposure) * uWB);
  vec3 pb = toSrgb(toLin(blur) * exp2(uExposure) * uWB);
  float L = luma(p), Lb = luma(pb);
  // Clarity: local contrast against the blurred neighbourhood, strongest in the midtones.
  float mid = 1.0 - pow(abs(2.0 * clamp(L, 0.0, 1.0) - 1.0), 2.0);
  p += (L - Lb) * uClarity * 1.4 * mid;
  // Shadows / highlights, masked by neighbourhood brightness so fine detail is kept.
  L = max(luma(p), 0.0);
  float sh = 1.0 - smoothstep(0.0, 0.6, Lb);
  float hi = smoothstep(0.35, 1.0, Lb);
  float nL = L + uShadows * 0.45 * sh * (uShadows > 0.0 ? (1.0 - min(L, 1.0)) : L);
  nL += uHighlights * 0.5 * hi * (uHighlights > 0.0 ? max(1.0 - nL, 0.0) : nL);
  p = L > 0.002 ? p * (nL / L) : p + (nL - L);
  // Contrast around mid-grey.
  float k = uContrast > 0.0 ? 1.0 + uContrast * 0.9 : 1.0 + uContrast * 0.6;
  p = clamp((p - 0.5) * k + 0.5, 0.0, 1.0);
  // Vibrance boosts dull colours more than already-saturated ones; saturation is uniform.
  L = luma(p);
  float s = max(p.r, max(p.g, p.b)) - min(p.r, min(p.g, p.b));
  p = mix(vec3(L), p, 1.0 + uSaturation);
  p = mix(vec3(L), p, 1.0 + uVibrance * (1.0 - s) * 1.3);
  p = clamp(p, 0.0, 1.0);
  // RGB curves.
  p = p * (255.0 / 256.0) + 0.5 / 256.0;
  p = vec3(texture(uLut, vec2(p.r, 0.5)).r, texture(uLut, vec2(p.g, 0.5)).g, texture(uLut, vec2(p.b, 0.5)).b);
  // Colour grade (presets).
  p = pow(max(p * uGain + uLift * (1.0 - p), 0.0), 1.0 / uGamma);
  L = luma(p);
  p += uShTint * (1.0 - L) * (1.0 - L) * 1.5 + uHiTint * L * L * 1.5;
  p = (p - 0.5) * (1.0 + uGContrast) + 0.5;
  L = luma(p);
  p = mix(vec3(L), p, uMono ? 0.0 : uGSat);
  p = mix(p, 0.06 + p * 0.88, uFade);
  return clamp(p, 0.0, 1.0);
}

void main() {
  vec2 px = gl_FragCoord.xy + uTile;
  vec2 uv = px / uOut;
  if (uFlipY) uv.y = 1.0 - uv.y;
  vec2 s = srcUV(uv);
  vec3 c = texture(uSrc, s).rgb;
  if (uBypass) { o = vec4(c, 1.0); return; }
  if (uSharpen > 0.0) {
    vec2 dx = dFdx(s), dy = dFdy(s);
    vec3 n = texture(uSrc, s + dx).rgb + texture(uSrc, s - dx).rgb + texture(uSrc, s + dy).rgb + texture(uSrc, s - dy).rgb;
    c = clamp(c + uSharpen * 1.6 * (c - n * 0.25), 0.0, 1.0);
  }
  vec3 p = develop(c, texture(uBlur, s).rgb);
  float r = length((uv - 0.5) * 2.0) / 1.4142;
  float v = smoothstep(0.3, 1.0, r);
  p = uVignette < 0.0 ? p * (1.0 + uVignette * 0.85 * v) : mix(p, vec3(1.0), uVignette * 0.55 * v);
  if (uGrain > 0.0) {
    vec2 cell = floor(px / uGrainCell);
    float n = hash(cell) + hash(cell + 17.31) - 1.0;
    float Lg = luma(p);
    p += uGrain * 0.2 * n * (0.45 + 0.55 * (1.0 - abs(2.0 * Lg - 1.0)));
  }
  p = clamp(p, 0.0, 1.0);
  float a = 1.0;
  if (uHasMask && uBgMode > 0) {
    float m = texture(uMask, s).r;
    float w = max(uEdge, 0.004);
    a = smoothstep(0.5 - w, 0.5 + w, m);
    if (uBgMode == 1) { o = vec4(p, a); return; }
    vec3 bb = texture(uBlurBig, s).rgb;
    vec3 bgc = uBgMode == 2 ? uBgColor : develop(bb, bb);
    p = mix(bgc, p, a);
    a = 1.0;
  }
  o = vec4(p, a);
}`;

// Separable Gaussian blur for the clarity / shadows mask and the blurred background.
const BLUR_FS = `#version 300 es
precision highp float;
uniform sampler2D uTex; uniform vec2 uDir; uniform float uSigma; uniform bool uCopy;
out vec4 o;
void main() {
  if (uCopy) { o = texture(uTex, gl_FragCoord.xy / uDir); return; }
  vec2 size = vec2(textureSize(uTex, 0));
  vec2 uv = gl_FragCoord.xy / size;
  vec3 acc = vec3(0.0); float wsum = 0.0;
  for (int i = -14; i <= 14; i++) {
    float w = exp(-float(i * i) / (2.0 * uSigma * uSigma));
    acc += texture(uTex, uv + uDir * float(i) / size).rgb * w;
    wsum += w;
  }
  o = vec4(acc / wsum, 1.0);
}`;

export interface Geometry {
  /** Size of the cropped area in source pixels (the full-resolution output size). */
  cropW: number;
  cropH: number;
  /** How far the crop can move left/right and up/down from the centre, in source pixels. */
  slackX: number;
  slackY: number;
  A: Float32Array;
  k: number;
  kNorm: number;
}

type M3 = number[]; // row-major 3x3
const mul = (a: M3, b: M3): M3 => {
  const r = new Array(9).fill(0);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) r[i * 3 + j] += a[i * 3 + k] * b[k * 3 + j];
  return r;
};

/** Crop / rotate / flip / lens geometry for a W×H source. */
export function geometry(W: number, H: number, p: Params): Geometry {
  const odd = p.rotate % 2 === 1;
  const Wo = odd ? H : W;
  const Ho = odd ? W : H;
  const ratio = ASPECTS.find((a) => a.id === p.aspect)?.ratio ?? Wo / Ho;
  let cw = Math.min(Wo, Ho * ratio);
  let ch = cw / ratio;
  const th = (p.straighten * Math.PI) / 180;
  const c = Math.abs(Math.cos(th));
  const s = Math.abs(Math.sin(th));
  const fit = Math.min(1, Wo / (cw * c + ch * s), Ho / (cw * s + ch * c));
  cw *= fit / p.zoom;
  ch *= fit / p.zoom;
  const k = (-0.3 * p.telephoto) / 100; // > 0 = wide-angle bulge, < 0 = telephoto
  const kNorm = k > 0 ? 1 / (1 + k) : 1;
  const slackX = Math.max(0, (Wo - (cw * c + ch * s)) / 2);
  const slackY = Math.max(0, (Ho - (cw * s + ch * c)) / 2);
  const cx = Wo / 2 + p.panX * slackX;
  const cy = Ho / 2 + p.panY * slackY;
  const cos = Math.cos(th);
  const sin = Math.sin(th);
  let m: M3 = [cos, -sin, cx, sin, cos, cy, 0, 0, 1];
  if (p.flipH) m = mul([-1, 0, Wo, 0, 1, 0, 0, 0, 1], m);
  if (p.flipV) m = mul([1, 0, 0, 0, -1, Ho, 0, 0, 1], m);
  const unrot: M3[] = [
    [1, 0, 0, 0, 1, 0, 0, 0, 1],
    [0, 1, 0, -1, 0, H, 0, 0, 1],
    [-1, 0, W, 0, -1, H, 0, 0, 1],
    [0, -1, W, 1, 0, 0, 0, 0, 1],
  ];
  m = mul(unrot[p.rotate], m);
  m = mul([1 / W, 0, 0, 0, 1 / H, 0, 0, 0, 1], m);
  // GL wants column-major.
  const A = new Float32Array([m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]]);
  return { cropW: cw, cropH: ch, slackX, slackY, A, k, kNorm };
}

const hexRgb = (h: string): [number, number, number] => {
  const n = parseInt(h.replace('#', ''), 16) || 0;
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

function wbGains(temp: number, tint: number): [number, number, number] {
  const t = temp / 100;
  const m = tint / 100;
  const g: [number, number, number] = [1 + 0.35 * t, 1 - 0.25 * m, 1 - 0.35 * t];
  const l = 0.2126 * g[0] + 0.7152 * g[1] + 0.0722 * g[2];
  return [g[0] / l, g[1] / l, g[2] / l];
}

export interface Histogram { r: Uint32Array; g: Uint32Array; b: Uint32Array; l: Uint32Array; max: number }

export class PhotoEngine {
  private gl: WebGL2RenderingContext;
  private prog: WebGLProgram;
  private blurProg: WebGLProgram;
  private u = new Map<string, WebGLUniformLocation | null>();
  private bu = new Map<string, WebGLUniformLocation | null>();
  private src: WebGLTexture | null = null;
  private blur: WebGLTexture | null = null;
  private blurBig: WebGLTexture | null = null;
  private mask: WebGLTexture;
  private lut: WebGLTexture;
  private lutKey = '';
  private hasMask = false;
  private fbo: WebGLFramebuffer;
  readonly maxSize: number;
  width = 0;
  height = 0;

  constructor(readonly canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', { premultipliedAlpha: false, preserveDrawingBuffer: false, antialias: false });
    if (!gl) throw new Error('This browser can’t run the editor (WebGL2 is not available).');
    this.gl = gl;
    this.maxSize = Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE) as number, 16384);
    this.prog = this.program(FS);
    this.blurProg = this.program(BLUR_FS);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    for (const pr of [this.prog, this.blurProg]) {
      const loc = gl.getAttribLocation(pr, 'aPos');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    }
    this.mask = this.texture();
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, 1, 1, 0, gl.RED, gl.UNSIGNED_BYTE, new Uint8Array([255]));
    this.lut = this.texture();
    this.fbo = gl.createFramebuffer()!;
  }

  private program(fs: string) {
    const gl = this.gl;
    const sh = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader error');
      return s;
    };
    const p = gl.createProgram()!;
    gl.attachShader(p, sh(gl.VERTEX_SHADER, VS));
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(p, 0, 'aPos');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? 'link error');
    return p;
  }

  private loc(name: string, blur = false) {
    const map = blur ? this.bu : this.u;
    if (!map.has(name)) map.set(name, this.gl.getUniformLocation(blur ? this.blurProg : this.prog, name));
    return map.get(name)!;
  }

  private texture(filter: number = this.gl.LINEAR) {
    const gl = this.gl;
    const t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }

  private target(w: number, h: number) {
    const gl = this.gl;
    const t = this.texture();
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    return t;
  }

  /** Loads a photo (already decoded and EXIF-rotated). Returns false if it had to be scaled down to fit the GPU. */
  setImage(img: ImageBitmap | HTMLCanvasElement) {
    const gl = this.gl;
    for (const t of [this.src, this.blur, this.blurBig]) if (t) gl.deleteTexture(t);
    this.width = img.width;
    this.height = img.height;
    this.src = this.texture(gl.LINEAR_MIPMAP_LINEAR);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.generateMipmap(gl.TEXTURE_2D);
    this.blur = this.blurred(this.src, 512, 5);
    this.blurBig = this.blurred(this.blur, 256, 5);
    this.setMask(null);
  }

  private blurred(from: WebGLTexture, long: number, sigma: number) {
    const gl = this.gl;
    const scale = long / Math.max(this.width, this.height);
    const w = Math.max(8, Math.round(this.width * scale));
    const h = Math.max(8, Math.round(this.height * scale));
    const a = this.target(w, h);
    const b = this.target(w, h);
    gl.useProgram(this.blurProg);
    gl.uniform1i(this.loc('uTex', true), 0);
    const pass = (input: WebGLTexture, out: WebGLTexture, dir: [number, number], copy: boolean) => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, out, 0);
      gl.viewport(0, 0, w, h);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, input);
      gl.uniform1i(this.loc('uCopy', true), copy ? 1 : 0);
      gl.uniform2f(this.loc('uDir', true), ...(copy ? ([w, h] as [number, number]) : dir));
      gl.uniform1f(this.loc('uSigma', true), sigma);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };
    pass(from, a, [0, 0], true);
    pass(a, b, [1, 0], false);
    pass(b, a, [0, 1], false);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.deleteTexture(b);
    return a;
  }

  /** The subject mask from background removal (0–255, any size: it's stretched over the photo). */
  setMask(data: Uint8Array | null, w = 1, h = 1) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.mask);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, data ? w : 1, data ? h : 1, 0, gl.RED, gl.UNSIGNED_BYTE, data ?? new Uint8Array([255]));
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
    this.hasMask = Boolean(data);
  }

  geometry(p: Params) {
    return geometry(this.width, this.height, p);
  }

  /** Full-resolution output size (before any export resize). */
  outputSize(p: Params) {
    const g = this.geometry(p);
    return { w: Math.max(1, Math.round(g.cropW)), h: Math.max(1, Math.round(g.cropH)) };
  }

  private setUniforms(p: Params, outW: number, outH: number, opts: { bypass?: boolean; flip?: boolean; forceBg?: string }) {
    const gl = this.gl;
    const g = this.geometry(p);
    gl.useProgram(this.prog);
    const lutKey = JSON.stringify(p.curves);
    if (lutKey !== this.lutKey) {
      gl.bindTexture(gl.TEXTURE_2D, this.lut);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, curvesLut(p.curves));
      this.lutKey = lutKey;
    }
    const tex: [string, WebGLTexture | null][] = [['uSrc', this.src], ['uBlur', this.blur], ['uBlurBig', this.blurBig], ['uMask', this.mask], ['uLut', this.lut]];
    tex.forEach(([name, t], i) => {
      gl.activeTexture(gl.TEXTURE0 + i);
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.uniform1i(this.loc(name), i);
    });
    const f = (n: string, v: number) => gl.uniform1f(this.loc(n), v);
    const v3 = (n: string, v: number[]) => gl.uniform3f(this.loc(n), v[0], v[1], v[2]);
    gl.uniform2f(this.loc('uOut'), outW, outH);
    gl.uniform1i(this.loc('uFlipY'), opts.flip ? 1 : 0);
    gl.uniform2f(this.loc('uCrop'), g.cropW, g.cropH);
    gl.uniformMatrix3fv(this.loc('uA'), false, g.A);
    f('uK', g.k);
    f('uKNorm', g.kNorm);
    f('uExposure', p.exposure);
    f('uContrast', p.contrast / 100);
    f('uHighlights', p.highlights / 100);
    f('uShadows', p.shadows / 100);
    f('uVibrance', p.vibrance / 100);
    f('uSaturation', p.saturation / 100);
    f('uClarity', p.clarity / 100);
    f('uSharpen', p.sharpen / 100);
    f('uGrain', p.grain / 100);
    f('uGrainCell', Math.max(1, Math.max(outW, outH) / 1600));
    f('uVignette', p.vignette / 100);
    v3('uWB', wbGains(p.temp, p.tint));
    const gr = gradeFor(p);
    v3('uLift', gr.lift);
    v3('uGamma', gr.gamma);
    v3('uGain', gr.gain);
    v3('uShTint', gr.shadowTint);
    v3('uHiTint', gr.highTint);
    f('uFade', gr.fade);
    f('uGSat', gr.sat);
    f('uGContrast', gr.contrast);
    gl.uniform1i(this.loc('uMono'), gr.mono ? 1 : 0);
    const mode = { keep: 0, transparent: 1, color: 2, blur: 3 }[p.bg];
    gl.uniform1i(this.loc('uBgMode'), opts.forceBg && mode === 1 ? 2 : mode);
    v3('uBgColor', hexRgb(opts.forceBg && mode === 1 ? opts.forceBg : p.bgColor));
    gl.uniform1i(this.loc('uHasMask'), this.hasMask ? 1 : 0);
    f('uEdge', 0.004 + (p.edge / 100) * 0.3);
    gl.uniform1i(this.loc('uBypass'), opts.bypass ? 1 : 0);
  }

  /** Draws the preview into the visible canvas (its width/height must already match the crop's aspect). */
  render(p: Params, opts: { bypass?: boolean } = {}) {
    if (!this.src) return;
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    this.setUniforms(p, this.canvas.width, this.canvas.height, { ...opts, flip: true });
    gl.uniform2f(this.loc('uTile'), 0, 0);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  /** Renders the result at w×h in tiles; calls `onTile` with each tile's pixels (straight RGBA, top-down rows). */
  private renderTiles(p: Params, w: number, h: number, opts: { bypass?: boolean; forceBg?: string }, onTile: (x: number, y: number, tw: number, th: number, px: Uint8Array) => void) {
    const gl = this.gl;
    const T = Math.min(2048, this.maxSize);
    const tex = this.target(Math.min(T, w), Math.min(T, h));
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    this.setUniforms(p, w, h, opts);
    const buf = new Uint8Array(Math.min(T, w) * Math.min(T, h) * 4);
    for (let y = 0; y < h; y += T) {
      for (let x = 0; x < w; x += T) {
        const tw = Math.min(T, w - x);
        const th = Math.min(T, h - y);
        gl.viewport(0, 0, tw, th);
        gl.uniform2f(this.loc('uTile'), x, y);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        const px = buf.subarray(0, tw * th * 4);
        gl.readPixels(0, 0, tw, th, gl.RGBA, gl.UNSIGNED_BYTE, px);
        onTile(x, y, tw, th, px);
      }
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.deleteTexture(tex);
  }

  /** A small rendering of the result (for the histogram and auto-enhance). */
  sample(p: Params, long = 256, opts: { bypass?: boolean } = {}) {
    const o = this.outputSize(p);
    const s = long / Math.max(o.w, o.h);
    const w = Math.max(1, Math.round(o.w * s));
    const h = Math.max(1, Math.round(o.h * s));
    const out = new Uint8Array(w * h * 4);
    this.renderTiles(p, w, h, opts, (x, y, tw, th, px) => {
      for (let r = 0; r < th; r++) out.set(px.subarray(r * tw * 4, (r + 1) * tw * 4), ((y + r) * w + x) * 4);
    });
    return { w, h, data: out };
  }

  histogram(p: Params): Histogram {
    const { data } = this.sample(p, 200);
    const r = new Uint32Array(256), g = new Uint32Array(256), b = new Uint32Array(256), l = new Uint32Array(256);
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 128) continue;
      r[data[i]]++;
      g[data[i + 1]]++;
      b[data[i + 2]]++;
      l[Math.round(0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2])]++;
    }
    let max = 1;
    // Ignore the two end bins when scaling, so a clipped sky doesn't flatten the rest.
    for (const a of [r, g, b, l]) for (let i = 1; i < 255; i++) max = Math.max(max, a[i]);
    return { r, g, b, l, max };
  }

  /** Full-quality export. `long` limits the longest side (0 = full resolution). */
  async export(p: Params, opts: { type: 'image/png' | 'image/jpeg' | 'image/webp'; quality: number; long: number }): Promise<{ blob: Blob; w: number; h: number }> {
    const o = this.outputSize(p);
    const s = opts.long && Math.max(o.w, o.h) > opts.long ? opts.long / Math.max(o.w, o.h) : 1;
    const w = Math.max(1, Math.round(o.w * s));
    const h = Math.max(1, Math.round(o.h * s));
    const out = document.createElement('canvas');
    out.width = w;
    out.height = h;
    const ctx = out.getContext('2d');
    if (!ctx) throw new Error('Not enough memory to export at this size — try a smaller size.');
    this.renderTiles(p, w, h, { forceBg: opts.type === 'image/jpeg' ? '#ffffff' : undefined }, (x, y, tw, th, px) => {
      ctx.putImageData(new ImageData(new Uint8ClampedArray(px), tw, th), x, y);
    });
    const blob = await new Promise<Blob | null>((res) => out.toBlob(res, opts.type, opts.quality));
    out.width = out.height = 0;
    if (!blob) throw new Error('The browser couldn’t create the file — try a smaller size or another format.');
    return { blob, w, h };
  }
}
