import { type TriangleMeshWriter } from '../../../core/geometry/triangle-mesh-writer';

const EPSILON = 0.000001;

/** 写入独立顶点三角形并计算稳定硬分面法线。 */
export function appendVanguardTriangle(
  writer: TriangleMeshWriter,
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
  cx: number,
  cy: number,
  cz: number,
): void {
  const edgeABX = bx - ax;
  const edgeABY = by - ay;
  const edgeABZ = bz - az;
  const edgeACX = cx - ax;
  const edgeACY = cy - ay;
  const edgeACZ = cz - az;
  const crossX = edgeABY * edgeACZ - edgeABZ * edgeACY;
  const crossY = edgeABZ * edgeACX - edgeABX * edgeACZ;
  const crossZ = edgeABX * edgeACY - edgeABY * edgeACX;
  const inverseLength = 1 / Math.max(Math.hypot(crossX, crossY, crossZ), EPSILON);
  const normalX = crossX * inverseLength;
  const normalY = crossY * inverseLength;
  const normalZ = crossZ * inverseLength;
  const aIndex = writer.vertex(ax, ay, az, normalX, normalY, normalZ);
  const bIndex = writer.vertex(bx, by, bz, normalX, normalY, normalZ);
  const cIndex = writer.vertex(cx, cy, cz, normalX, normalY, normalZ);
  writer.triangle(aIndex, bIndex, cIndex);
}
