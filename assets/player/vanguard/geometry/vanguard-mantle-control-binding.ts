import { VANGUARD_MANTLE_PARTICLE_COUNT } from '../model/vanguard-mantle-particles';

/** 披风中面粒子到编译控制笼顶点的固定覆盖关系。 */
export interface VanguardMantleControlBinding {
  readonly controlVertices: Uint16Array;
  readonly particleIndices: Uint8Array;
  readonly normalOffsets: Float32Array;
}

/** 校验并压缩披风局部控制点绑定。 */
export function createVanguardMantleControlBinding(
  controlVertices: readonly number[],
  particleIndices: readonly number[],
  normalOffsets: readonly number[],
): VanguardMantleControlBinding {
  if (controlVertices.length !== particleIndices.length
    || controlVertices.length !== normalOffsets.length) {
    throw new Error('披风控制点绑定数组长度不一致。');
  }
  for (let index = 0; index < controlVertices.length; index++) {
    const controlVertex = controlVertices[index];
    const particle = particleIndices[index];
    const normalOffset = normalOffsets[index];
    if (!Number.isInteger(controlVertex) || controlVertex < 0 || controlVertex > 65535) {
      throw new Error(`披风控制点索引无效：${controlVertex}`);
    }
    if (!Number.isInteger(particle) || particle < 0 || particle >= VANGUARD_MANTLE_PARTICLE_COUNT) {
      throw new Error(`披风粒子索引无效：${particle}`);
    }
    if (!Number.isFinite(normalOffset)) {
      throw new Error(`披风控制点法线偏移无效：${normalOffset}`);
    }
  }
  return Object.freeze({
    controlVertices: Uint16Array.from(controlVertices),
    particleIndices: Uint8Array.from(particleIndices),
    normalOffsets: Float32Array.from(normalOffsets),
  });
}

/** 把披风局部控制点索引平移到合并后的人物控制笼。 */
export function offsetVanguardMantleControlBinding(
  binding: Readonly<VanguardMantleControlBinding>,
  controlVertexOffset: number,
): VanguardMantleControlBinding {
  if (!Number.isInteger(controlVertexOffset) || controlVertexOffset < 0) {
    throw new Error(`披风控制点合并偏移无效：${controlVertexOffset}`);
  }
  const controls = new Array<number>(binding.controlVertices.length);
  for (let index = 0; index < controls.length; index++) {
    controls[index] = (binding.controlVertices[index] ?? 0) + controlVertexOffset;
  }
  return createVanguardMantleControlBinding(
    controls,
    Array.from(binding.particleIndices),
    Array.from(binding.normalOffsets),
  );
}
