import { TAU } from '../../../../../../core/math/scalar';

/**
 * 不规则液体扇面的固定采样计划。
 *
 * 顶点零始终为中心点；各射线的顶点偏移和单位圆采样在编译期固定。
 */
export interface FanSamplePlan {
  /** 外圈射线数量。 */
  readonly rayCount: number;
  /** 固定拓扑产生的顶点数量。 */
  readonly vertexCount: number;
  /** 固定拓扑产生的索引数量。 */
  readonly indexCount: number;
  /** 每条射线在局部顶点区间中的偏移。 */
  readonly rayVertexOffsets: Uint16Array;
  /** 外圈采样的余弦表。 */
  readonly rayCosines: Float32Array;
  /** 外圈采样的正弦表。 */
  readonly raySines: Float32Array;
  /** 相对当前扇面首顶点的固定索引。 */
  readonly indices: Uint16Array;
}

/**
 * 编译一个中心扇面的固定采样和局部索引计划。
 *
 * @param rayCount 外圈射线数量，至少为三。
 * @returns 可被每个实体复用的扇面计划。
 */
export function compileFanSamplePlan(rayCount: number): FanSamplePlan {
  if (!Number.isInteger(rayCount) || rayCount < 3) {
    throw new Error('扇面射线数量至少为三。');
  }

  const vertexCount = rayCount + 1;
  const indexCount = rayCount * 3;
  const rayVertexOffsets = new Uint16Array(rayCount);
  const rayCosines = new Float32Array(rayCount);
  const raySines = new Float32Array(rayCount);
  const indices = new Uint16Array(indexCount);

  let indexOffset = 0;
  for (let ray = 0; ray < rayCount; ray++) {
    const angle = ray / rayCount * TAU;
    rayVertexOffsets[ray] = ray + 1;
    rayCosines[ray] = Math.cos(angle);
    raySines[ray] = Math.sin(angle);
    indices[indexOffset] = 0;
    indices[indexOffset + 1] = ray + 1;
    indices[indexOffset + 2] = (ray + 1) % rayCount + 1;
    indexOffset += 3;
  }

  return Object.freeze({
    rayCount,
    vertexCount,
    indexCount,
    rayVertexOffsets,
    rayCosines,
    raySines,
    indices,
  });
}
