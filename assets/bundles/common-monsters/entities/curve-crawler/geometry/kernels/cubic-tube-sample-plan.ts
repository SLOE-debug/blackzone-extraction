import { TAU } from '../../../../../../core/math/scalar';

/**
 * 三次贝塞尔管体的固定采样计划。
 *
 * 顶点顺序以曲线截面为外层、径向采样为内层。位置和切线的贝塞尔系数、
 * 径向单位圆和局部索引都只在编译阶段计算一次。
 */
export interface CubicTubeSamplePlan {
  /** 曲线上的离散段数。 */
  readonly segmentCount: number;
  /** 每个截面的径向顶点数量。 */
  readonly radialCount: number;
  /** 固定拓扑产生的顶点数量。 */
  readonly vertexCount: number;
  /** 固定拓扑产生的索引数量。 */
  readonly indexCount: number;
  /** 每个曲线采样点对应四个控制点的位置贝塞尔系数。 */
  readonly positionCoefficients: Float32Array;
  /** 每个曲线采样点对应四个控制点的切线贝塞尔系数。 */
  readonly tangentCoefficients: Float32Array;
  /** 径向单位圆的余弦表。 */
  readonly radialCosines: Float32Array;
  /** 径向单位圆的正弦表。 */
  readonly radialSines: Float32Array;
  /** 相对当前管体首顶点的固定索引。 */
  readonly indices: Uint16Array;
}

/**
 * 编译一个三次贝塞尔管体的固定采样计划。
 *
 * @param segmentCount 曲线分段数量，至少为一。
 * @param radialCount 每个截面的径向采样数量，至少为三。
 * @returns 可由运行期 Kernel 重复复用的只读计划。
 */
export function compileCubicTubeSamplePlan(
  segmentCount: number,
  radialCount: number,
): CubicTubeSamplePlan {
  if (!Number.isInteger(segmentCount) || segmentCount <= 0) {
    throw new Error('贝塞尔管体分段数量必须是正整数。');
  }
  if (!Number.isInteger(radialCount) || radialCount < 3) {
    throw new Error('贝塞尔管体径向采样数量至少为三。');
  }

  const sampleCount = segmentCount + 1;
  const vertexCount = sampleCount * radialCount;
  if (vertexCount > 0xffff) {
    throw new Error('贝塞尔管体局部顶点数量超过 Uint16 索引范围。');
  }

  const positionCoefficients = new Float32Array(sampleCount * 4);
  const tangentCoefficients = new Float32Array(sampleCount * 4);
  for (let sample = 0; sample < sampleCount; sample++) {
    const t = sample / segmentCount;
    const inverse = 1 - t;
    const inverseSquared = inverse * inverse;
    const tSquared = t * t;
    const coefficientOffset = sample * 4;

    positionCoefficients[coefficientOffset] = inverseSquared * inverse;
    positionCoefficients[coefficientOffset + 1] = 3 * inverseSquared * t;
    positionCoefficients[coefficientOffset + 2] = 3 * inverse * tSquared;
    positionCoefficients[coefficientOffset + 3] = tSquared * t;

    tangentCoefficients[coefficientOffset] = -3 * inverseSquared;
    tangentCoefficients[coefficientOffset + 1] = 3 * inverseSquared - 6 * inverse * t;
    tangentCoefficients[coefficientOffset + 2] = 6 * inverse * t - 3 * tSquared;
    tangentCoefficients[coefficientOffset + 3] = 3 * tSquared;
  }

  const radialCosines = new Float32Array(radialCount);
  const radialSines = new Float32Array(radialCount);
  for (let radial = 0; radial < radialCount; radial++) {
    const angle = radial / radialCount * TAU;
    radialCosines[radial] = Math.cos(angle);
    radialSines[radial] = Math.sin(angle);
  }

  const indexCount = segmentCount * radialCount * 6;
  const indices = new Uint16Array(indexCount);
  let indexOffset = 0;
  for (let segment = 0; segment < segmentCount; segment++) {
    const currentRing = segment * radialCount;
    const nextRing = currentRing + radialCount;
    for (let radial = 0; radial < radialCount; radial++) {
      const nextRadial = (radial + 1) % radialCount;
      const current = currentRing + radial;
      const currentNext = currentRing + nextRadial;
      const next = nextRing + radial;
      const nextNext = nextRing + nextRadial;
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
    segmentCount,
    radialCount,
    vertexCount,
    indexCount,
    positionCoefficients,
    tangentCoefficients,
    radialCosines,
    radialSines,
    indices,
  });
}
