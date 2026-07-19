import { type SurfaceBufferGeometry } from '../../core/geometry/buffer-geometry';
import { type LobbyEffectsGeometryRanges } from '../geometry/lobby-effects-geometry';
import { lobbyEmissiveVertexShading } from './lobby-emissive-vertex-shading';

const GLASS_RED = 78 / 255;
const GLASS_GREEN = 116 / 255;
const GLASS_BLUE = 126 / 255;
const GLASS_ALPHA = 54 / 255;

/** 为统一效果批次写入不透明辉光与半透明玻璃的 RGBA 顶点色。 */
export function shadeLobbyEffects(
  geometry: SurfaceBufferGeometry,
  ranges: Readonly<LobbyEffectsGeometryRanges>,
): void {
  lobbyEmissiveVertexShading.update(geometry, ranges.emissive);
  const endVertex = ranges.glass.startVertex + ranges.glass.vertexCount;
  for (let vertex = ranges.glass.startVertex; vertex < endVertex; vertex++) {
    const offset = vertex * 4;
    geometry.colors[offset] = GLASS_RED;
    geometry.colors[offset + 1] = GLASS_GREEN;
    geometry.colors[offset + 2] = GLASS_BLUE;
    geometry.colors[offset + 3] = GLASS_ALPHA;
  }
}
