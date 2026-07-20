/** 程序化拓扑计算使用的只读三维点。 */
export interface FacetedPoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/**
 * 计算三角形绕序法线与期望朝外方向的点积。
 *
 * @param a 三角形第一个顶点。
 * @param b 三角形第二个顶点。
 * @param c 三角形第三个顶点。
 * @param outwardX 期望朝外方向的 X 分量。
 * @param outwardY 期望朝外方向的 Y 分量。
 * @param outwardZ 期望朝外方向的 Z 分量。
 * @returns 非负值表示当前绕序与期望方向一致。
 */
export function getTriangleOrientation(
  a: Readonly<FacetedPoint>,
  b: Readonly<FacetedPoint>,
  c: Readonly<FacetedPoint>,
  outwardX: number,
  outwardY: number,
  outwardZ: number,
): number {
  const edgeABX = b.x - a.x;
  const edgeABY = b.y - a.y;
  const edgeABZ = b.z - a.z;
  const edgeACX = c.x - a.x;
  const edgeACY = c.y - a.y;
  const edgeACZ = c.z - a.z;
  const normalX = edgeABY * edgeACZ - edgeABZ * edgeACY;
  const normalY = edgeABZ * edgeACX - edgeABX * edgeACZ;
  const normalZ = edgeABX * edgeACY - edgeABY * edgeACX;
  return normalX * outwardX + normalY * outwardY + normalZ * outwardZ;
}
