import {
  CURVE_CRAWLER_FRAGMENT_COUNT,
  CURVE_CRAWLER_LEG_COUNT,
} from '../../model/curve-crawler-schema';
import { type CurveCrawlerState } from '../../model/curve-crawler-state';

/** 每只 Curve Crawler 在姿态纹理中占用的固定 RGBA Texel。 */
export enum CurveCrawlerGpuPoseTexel {
  Transform,
  AnimationPrimary,
  AnimationSecondary,
  Lifecycle,
  Emergence,
  Effects,
  Morphology,
  LegPhaseFirst,
  FragmentFirst = LegPhaseFirst + CURVE_CRAWLER_LEG_COUNT / 2,
  Count = FragmentFirst + CURVE_CRAWLER_FRAGMENT_COUNT,
}

export const CURVE_CRAWLER_GPU_POSE_COMPONENT_COUNT = 4;
export const CURVE_CRAWLER_GPU_POSE_TEXEL_COUNT = CurveCrawlerGpuPoseTexel.Count;

/**
 * 保存共享批次的每实体 GPU 姿态参数。
 *
 * 每个实体独占一行，Shader 可用稳定 GPU Slot 直接定位；高频写入只覆盖长期复用的
 * Float32Array，不创建逐帧对象或子视图。
 */
export class CurveCrawlerGpuPoseBuffer {
  private values = new Float32Array(0);
  private entityCapacity = 0;

  public get capacity(): number {
    return this.entityCapacity;
  }

  public get data(): Float32Array {
    return this.values;
  }

  /** 按新的固定槽位容量重建 CPU 参数镜像。 */
  public resize(entityCapacity: number): void {
    if (!Number.isInteger(entityCapacity) || entityCapacity <= 0) {
      throw new Error('Curve Crawler GPU 姿态容量必须是正整数。');
    }
    if (entityCapacity === this.entityCapacity) {
      return;
    }
    this.entityCapacity = entityCapacity;
    this.values = new Float32Array(
      entityCapacity
        * CURVE_CRAWLER_GPU_POSE_TEXEL_COUNT
        * CURVE_CRAWLER_GPU_POSE_COMPONENT_COUNT,
    );
  }

  /** 清空未被活动群体覆盖的槽位。 */
  public begin(): void {
    this.values.fill(0);
  }

  /** 把一个群体的 SoA 姿态写入连续 GPU Slot 行。 */
  public writeState(state: CurveCrawlerState, gpuSlotOffset: number): void {
    if (!Number.isInteger(gpuSlotOffset)
      || gpuSlotOffset < 0
      || gpuSlotOffset + state.count > this.entityCapacity) {
      throw new Error('Curve Crawler GPU 姿态写入范围越界。');
    }
    const { transform, morphology, vitality, animation } = state.data;
    for (let entityIndex = 0; entityIndex < state.count; entityIndex++) {
      const gpuSlot = gpuSlotOffset + entityIndex;
      writeTexel(this.values, gpuSlot, CurveCrawlerGpuPoseTexel.Transform,
        transform.x[entityIndex] ?? 0,
        transform.y[entityIndex] ?? 0,
        transform.headingCosine[entityIndex] ?? 1,
        transform.headingSine[entityIndex] ?? 0);
      writeTexel(this.values, gpuSlot, CurveCrawlerGpuPoseTexel.AnimationPrimary,
        animation.phase[entityIndex] ?? 0,
        animation.bodyPulse[entityIndex] ?? 0,
        animation.crouchAmount[entityIndex] ?? 0,
        animation.biteAmount[entityIndex] ?? 0);
      writeTexel(this.values, gpuSlot, CurveCrawlerGpuPoseTexel.AnimationSecondary,
        animation.turnAmount[entityIndex] ?? 0,
        animation.turnDirection[entityIndex] ?? 1,
        animation.blinkScale[entityIndex] ?? 1,
        animation.hitFlash[entityIndex] ?? 0);
      writeTexel(this.values, gpuSlot, CurveCrawlerGpuPoseTexel.Lifecycle,
        vitality.state[entityIndex] ?? 0,
        animation.emergenceBodyScale[entityIndex] ?? 1,
        animation.emergenceLegScale[entityIndex] ?? 1,
        animation.surfaceCollapse[entityIndex] ?? 0);
      writeTexel(this.values, gpuSlot, CurveCrawlerGpuPoseTexel.Emergence,
        animation.crackSpread[entityIndex] ?? 0,
        animation.crackVisibility[entityIndex] ?? 0,
        animation.eggScale[entityIndex] ?? 0,
        animation.eggBulge[entityIndex] ?? 0);
      writeTexel(this.values, gpuSlot, CurveCrawlerGpuPoseTexel.Effects,
        animation.eggBurst[entityIndex] ?? 0,
        animation.liquidSpread[entityIndex] ?? 0,
        animation.liquidDrain[entityIndex] ?? 0,
        morphology.legLength[entityIndex] ?? 0);
      writeTexel(this.values, gpuSlot, CurveCrawlerGpuPoseTexel.Morphology,
        morphology.bodyLength[entityIndex] ?? 0,
        morphology.bodyWidth[entityIndex] ?? 0,
        morphology.legWidth[entityIndex] ?? 0,
        morphology.eyeRadius[entityIndex] ?? 0);

      const legOffset = entityIndex * CURVE_CRAWLER_LEG_COUNT;
      for (let pair = 0; pair < CURVE_CRAWLER_LEG_COUNT / 2; pair++) {
        const firstLeg = pair * 2;
        writeTexel(
          this.values,
          gpuSlot,
          CurveCrawlerGpuPoseTexel.LegPhaseFirst + pair,
          animation.legPhaseCosines[legOffset + firstLeg] ?? 1,
          animation.legPhaseSines[legOffset + firstLeg] ?? 0,
          animation.legPhaseCosines[legOffset + firstLeg + 1] ?? 1,
          animation.legPhaseSines[legOffset + firstLeg + 1] ?? 0,
        );
      }

      const fragmentOffset = entityIndex * CURVE_CRAWLER_FRAGMENT_COUNT;
      for (let fragment = 0; fragment < CURVE_CRAWLER_FRAGMENT_COUNT; fragment++) {
        writeTexel(
          this.values,
          gpuSlot,
          CurveCrawlerGpuPoseTexel.FragmentFirst + fragment,
          animation.fragmentOffsetX[fragmentOffset + fragment] ?? 0,
          animation.fragmentOffsetY[fragmentOffset + fragment] ?? 0,
          animation.fragmentOffsetZ[fragmentOffset + fragment] ?? 0,
          animation.fragmentRotation[fragmentOffset + fragment] ?? 0,
        );
      }
    }
  }
}

function writeTexel(
  target: Float32Array,
  gpuSlot: number,
  texel: number,
  x: number,
  y: number,
  z: number,
  w: number,
): void {
  const offset = (gpuSlot * CURVE_CRAWLER_GPU_POSE_TEXEL_COUNT + texel)
    * CURVE_CRAWLER_GPU_POSE_COMPONENT_COUNT;
  target[offset] = x;
  target[offset + 1] = y;
  target[offset + 2] = z;
  target[offset + 3] = w;
}
