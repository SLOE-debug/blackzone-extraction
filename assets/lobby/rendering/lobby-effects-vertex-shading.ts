import { type SurfaceBufferGeometry } from '../../core/geometry/buffer-geometry';

const GLASS_RED = 78 / 255;
const GLASS_GREEN = 116 / 255;
const GLASS_BLUE = 126 / 255;
const GLASS_ALPHA = 54 / 255;

/** 为独立透明观察玻璃批次写入稳定 RGBA 顶点色。 */
export function shadeLobbyGlass(geometry: SurfaceBufferGeometry): void {
  for (let vertex = 0; vertex < geometry.vertexCount; vertex++) {
    const offset = vertex * 4;
    geometry.colors[offset] = GLASS_RED;
    geometry.colors[offset + 1] = GLASS_GREEN;
    geometry.colors[offset + 2] = GLASS_BLUE;
    geometry.colors[offset + 3] = GLASS_ALPHA;
  }
}
