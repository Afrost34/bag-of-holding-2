import { defaultFilterVert, Filter, GlProgram, UniformGroup, type Texture } from 'pixi.js';

/**
 * Where a terrain texture fades into what is under it, the light parts of the texture show first
 * and the dark parts last, as if the texture were a height map (Dungeondraft blends its textures
 * the same way): grass pushes through gravel in tufts instead of dissolving as a flat gradient.
 * The brightness of each pixel, against the texture's own average, shifts the point along the
 * fade where it turns opaque.
 */

const fragment = `
in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform float uGain;
uniform float uMean;
void main() {
  vec4 c = texture(uTexture, vTextureCoord);
  if (c.a <= 0.001) { finalColor = vec4(0.0); return; }
  vec3 rgb = c.rgb / c.a;
  float lum = dot(rgb, vec3(0.299, 0.587, 0.114));
  // How high this pixel stands: its brightness against the texture's average, spread out.
  float h = clamp((lum - uMean) * uGain, -0.5, 0.5);
  // Only the middle of the fade moves: where the stroke is clear or opaque it stays so.
  float middle = 1.0 - abs(c.a * 2.0 - 1.0);
  float a = clamp((c.a - 0.5) * (1.0 + abs(uGain)) + 0.5 + h * middle * 1.6, 0.0, 1.0);
  finalColor = vec4(rgb * a, a);
}
`;

/** The filter for a stroke of one texture: `mean` is that texture's average brightness (0–1). */
export function heightBlendFilter(mean: number, gain = 2.2): Filter {
  const uniforms = new UniformGroup({
    uGain: { value: gain, type: 'f32' },
    uMean: { value: mean, type: 'f32' },
  });
  return new Filter({
    glProgram: GlProgram.from({ vertex: defaultFilterVert, fragment, name: 'height-blend' }),
    resources: { heightUniforms: uniforms },
  });
}

const means = new Map<number, number>();

/** A texture's average brightness (0–1), worked out once from a small copy of it; 0.5 if it cannot be read. */
export function textureMean(texture: Texture): number {
  const known = means.get(texture.uid);
  if (known !== undefined) return known;
  let mean = 0.5;
  try {
    const source = texture.source.resource as CanvasImageSource | undefined;
    if (source && typeof OffscreenCanvas !== 'undefined') {
      const canvas = new OffscreenCanvas(16, 16);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(source, 0, 0, 16, 16);
        const data = ctx.getImageData(0, 0, 16, 16).data;
        let sum = 0;
        let count = 0;
        for (let i = 0; i + 3 < data.length; i += 4) {
          if ((data[i + 3] ?? 0) < 8) continue;
          sum +=
            (0.299 * (data[i] ?? 0) + 0.587 * (data[i + 1] ?? 0) + 0.114 * (data[i + 2] ?? 0)) /
            255;
          count++;
        }
        if (count > 0) mean = sum / count;
      }
    }
  } catch {
    // Not readable (a texture still loading): the middle will do.
  }
  means.set(texture.uid, mean);
  return mean;
}
