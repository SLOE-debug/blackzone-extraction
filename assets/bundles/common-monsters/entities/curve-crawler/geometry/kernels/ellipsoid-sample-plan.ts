import { TAU } from '../../../../../../core/math/scalar';

/**
 * 绕局部 Z 轴旋转的椭球固定采样计划。
 *
 * 单位方向在初始化时烘焙，运行期仅按当前半径缩放、旋转并写入顶点流。
 */
export interface EllipsoidSamplePlan {
  /** 经线分段数量。 */
  readonly longitudeCount: number;
  /** 纬线分段数量。 */
  readonly latitudeCount: number;
  /** 固定拓扑产生的顶点数量。 */
  readonly vertexCount: number;
  /** 固定拓扑产生的索引数量。 */
  readonly indexCount: number;
  /** 每个顶点对应的单位椭球方向，三个分量连续存储。 */
  readonly unitDirections: Float32Array;
  /** 相对当前椭球首顶点的固定索引。 */
  readonly indices: Uint16Array;
}

/**
 * 编译一个椭球的固定采样和局部索引计划。
 *
 * @param longitudeCount 经线分段数量，至少为三。
 * @param latitudeCount 纬线分段数量，至少为二。
 * @returns 可被多个同规格椭球共享的计划。
 */
export function compileEllipsoidSamplePlan(
  longitudeCount: number,
  latitudeCount: number,
): EllipsoidSamplePlan {
  if (!Number.isInteger(longitudeCount) || longitudeCount < 3) {
    throw new Error('椭球经线分段数量至少为三。');
  }
  if (!Number.isInteger(latitudeCount) || latitudeCount < 2) {
    throw new Error('椭球纬线分段数量至少为二。');
  }

  const ringVertexCount = longitudeCount + 1;
  const vertexCount = ringVertexCount * (latitudeCount + 1);
  if (vertexCount > 0xffff) {
    throw new Error('椭球局部顶点数量超过 Uint16 索引范围。');
  }

  const unitDirections = new Float32Array(vertexCount * 3);
  let directionOffset = 0;
  for (let latitude = 0; latitude <= latitudeCount; latitude++) {
    const latitudeAngle = latitude / latitudeCount * Math.PI - Math.PI * 0.5;
    const latitudeCosine = Math.cos(latitudeAngle);
    const latitudeSine = Math.sin(latitudeAngle);
    for (let longitude = 0; longitude <= longitudeCount; longitude++) {
      const longitudeAngle = longitude / longitudeCount * TAU;
      unitDirections[directionOffset] = latitudeCosine * Math.cos(longitudeAngle);
      unitDirections[directionOffset + 1] = latitudeCosine * Math.sin(longitudeAngle);
      unitDirections[directionOffset + 2] = latitudeSine;
      directionOffset += 3;
    }
  }

  const indexCount = longitudeCount * latitudeCount * 6;
  const indices = new Uint16Array(indexCount);
  let indexOffset = 0;
  for (let latitude = 0; latitude < latitudeCount; latitude++) {
    const currentRing = latitude * ringVertexCount;
    const nextRing = currentRing + ringVertexCount;
    for (let longitude = 0; longitude < longitudeCount; longitude++) {
      const current = currentRing + longitude;
      const currentNext = current + 1;
      const next = nextRing + longitude;
      const nextNext = next + 1;
      indices[indexOffset] = current;
      indices[indexOffset + 1] = currentNext;
      indices[indexOffset + 2] = next;
      indices[indexOffset + 3] = currentNext;
      indices[indexOffset + 4] = nextNext;
      indices[indexOffset + 5] = next;
      indexOffset += 6;
    }
  }

  return Object.freeze({
    longitudeCount,
    latitudeCount,
    vertexCount,
    indexCount,
    unitDirections,
    indices,
  });
}
