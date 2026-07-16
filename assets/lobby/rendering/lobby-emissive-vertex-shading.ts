import { type SurfaceBufferGeometry } from '../../core/geometry/buffer-geometry';
import { type LobbyEmissiveGeometryRanges } from '../geometry/lobby-emissive-geometry';
import { LOBBY_KEY_LIGHT_COLOR } from '../model/lobby-lighting-config';

const BYTE_COLOR_SCALE = 1 / 255;
const LAMP_GLOW_COLOR = Object.freeze({
  red: LOBBY_KEY_LIGHT_COLOR.red * BYTE_COLOR_SCALE,
  green: LOBBY_KEY_LIGHT_COLOR.green * BYTE_COLOR_SCALE,
  blue: LOBBY_KEY_LIGHT_COLOR.blue * BYTE_COLOR_SCALE,
});
const RITUAL_GLOW_COLOR = Object.freeze({ red: 1, green: 18 / 255, blue: 42 / 255 });

/** 为合批后的顶灯与仪式灯写入彼此独立的发光色。 */
export class LobbyEmissiveVertexShading {
  /** 原地刷新大厅发光合批的完整颜色流。 */
  public update(
    geometry: SurfaceBufferGeometry,
    ranges: Readonly<LobbyEmissiveGeometryRanges>,
  ): void {
    shadeVertexRange(geometry, ranges.lampGlow, LAMP_GLOW_COLOR);
    shadeVertexRange(geometry, ranges.ritualGlow, RITUAL_GLOW_COLOR);
  }
}

/** 把稳定纯色写入指定连续顶点范围。 */
function shadeVertexRange(
  geometry: SurfaceBufferGeometry,
  range: Readonly<{ startVertex: number; vertexCount: number }>,
  color: Readonly<{ red: number; green: number; blue: number }>,
): void {
  const endVertex = range.startVertex + range.vertexCount;
  for (let vertex = range.startVertex; vertex < endVertex; vertex++) {
    const colorOffset = vertex * 4;
    geometry.colors[colorOffset] = color.red;
    geometry.colors[colorOffset + 1] = color.green;
    geometry.colors[colorOffset + 2] = color.blue;
    geometry.colors[colorOffset + 3] = 1;
  }
}

export const lobbyEmissiveVertexShading = new LobbyEmissiveVertexShading();
