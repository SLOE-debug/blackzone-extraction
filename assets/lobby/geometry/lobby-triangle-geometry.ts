import { type TriangleMeshWriter } from '../../core/geometry/triangle-mesh-writer';
import { emitFixedTopologyFlatTriangle } from '../../core/geometry/faceted/faceted-emitter';

/** 几何写入阶段使用的只读三维点。 */
export interface LobbyPoint3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** 写入独立顶点三角形，并由绕序计算稳定分面法线。 */
export function appendLobbyTriangle(
  writer: TriangleMeshWriter,
  a: Readonly<LobbyPoint3>,
  b: Readonly<LobbyPoint3>,
  c: Readonly<LobbyPoint3>,
): void {
  emitFixedTopologyFlatTriangle(writer, undefined, a, b, c);
}

/**
 * 用交替对角线把四边形拆为两个三角形。
 *
 * @param reverseWinding 是否反转基础绕序以朝向大厅内部。
 */
export function appendLobbyGridCell(
  writer: TriangleMeshWriter,
  p00: Readonly<LobbyPoint3>,
  p10: Readonly<LobbyPoint3>,
  p11: Readonly<LobbyPoint3>,
  p01: Readonly<LobbyPoint3>,
  alternateDiagonal: boolean,
  reverseWinding: boolean,
): void {
  if (alternateDiagonal) {
    appendOrientedTriangle(writer, p00, p10, p01, reverseWinding);
    appendOrientedTriangle(writer, p10, p11, p01, reverseWinding);
    return;
  }

  appendOrientedTriangle(writer, p00, p10, p11, reverseWinding);
  appendOrientedTriangle(writer, p00, p11, p01, reverseWinding);
}

/** 返回确定性的有符号扰动，避免依赖运行时随机状态。 */
export function getLobbyGeometryJitter(
  first: number,
  second: number,
  seed: number,
  amplitude: number,
): number {
  const value = Math.sin(
    first * 12.9898 + second * 78.233 + seed * 37.719,
  ) * 43758.5453;
  const fraction = value - Math.floor(value);
  return (fraction * 2 - 1) * amplitude;
}

/** 根据目标绕序写入三角形。 */
function appendOrientedTriangle(
  writer: TriangleMeshWriter,
  a: Readonly<LobbyPoint3>,
  b: Readonly<LobbyPoint3>,
  c: Readonly<LobbyPoint3>,
  reverseWinding: boolean,
): void {
  if (reverseWinding) {
    appendLobbyTriangle(writer, a, c, b);
  } else {
    appendLobbyTriangle(writer, a, b, c);
  }
}
