import { type StaticSurfaceBufferGeometry } from '../../../core/geometry/buffer-geometry';
import { BATTLEFIELD_LAYOUT } from '../model/battlefield-layout';

const BYTE_COLOR_SCALE = 1 / 255;
const BASE_RED = 42 * BYTE_COLOR_SCALE;
const BASE_GREEN = 54 * BYTE_COLOR_SCALE;
const BASE_BLUE = 48 * BYTE_COLOR_SCALE;

/** 为战场岩地写入灰绿顶点色、分面色差和归一化 UV。 */
export function shadeBattlefieldGround(geometry: StaticSurfaceBufferGeometry): void {
  const extent = BATTLEFIELD_LAYOUT.groundHalfExtent;
  for (let vertex = 0; vertex < geometry.vertexCount; vertex++) {
    const positionOffset = vertex * 3;
    const colorOffset = vertex * 4;
    const uvOffset = vertex * 2;
    const x = geometry.positions[positionOffset] ?? 0;
    const y = geometry.positions[positionOffset + 1] ?? 0;
    const z = geometry.positions[positionOffset + 2] ?? 0;
    const normalY = geometry.normals[positionOffset + 1] ?? 1;
    const triangleVariant = (Math.floor(vertex / 3) * 37 % 9) / 8;
    const heightShade = Math.max(-0.08, Math.min(0.12, y * 0.035));
    const facetShade = 0.78 + Math.max(0, normalY) * 0.13 + triangleVariant * 0.09;
    const shade = facetShade + heightShade;
    geometry.colors[colorOffset] = Math.min(1, BASE_RED * shade);
    geometry.colors[colorOffset + 1] = Math.min(1, BASE_GREEN * (shade + 0.025));
    geometry.colors[colorOffset + 2] = Math.min(1, BASE_BLUE * shade);
    geometry.colors[colorOffset + 3] = 1;
    geometry.uvs[uvOffset] = (x + extent) / (extent * 2);
    geometry.uvs[uvOffset + 1] = (z + extent) / (extent * 2);
  }
}
