import { MonsterLifecycleState } from '../../../../../core/contracts/monster-lifecycle';
import { createEntityRange } from '../../../../../core/entities/entity-range';
import { MeshDirty } from '../../../../../core/mesh/mesh-dirty';
import { type VertexStreams } from '../../../../../core/mesh/vertex-streams';
import { CurveCrawlerMotionProfile } from '../model/curve-crawler-motion-profile';
import {
  CURVE_CRAWLER_FRAGMENT_COUNT,
  CURVE_CRAWLER_LEG_COUNT,
  CURVE_CRAWLER_LIQUID_RAY_COUNT,
} from '../model/curve-crawler-schema';
import { CurveCrawlerState } from '../model/curve-crawler-state';
import { CurveCrawlerMeshEvaluator } from './curve-crawler-mesh-evaluator';
import { type CurveCrawlerMeshPlan } from './curve-crawler-mesh-plan';

/**
 * 为 GPU 形变管线生成一只实体的完整局部 Bind Pose。
 *
 * Body、Liquid、Crack、Egg 与 Shard 分别在其可读阶段求值，最后合并到同一固定拓扑。
 * 该过程只在共享批次结构创建时运行，不进入逐帧模拟路径。
 */
export class CurveCrawlerGpuBindPoseBuilder {
  private readonly state = new CurveCrawlerState({
    count: 1,
    spawnArea: Object.freeze({ centerX: 0, centerY: 0, width: 1, height: 1 }),
    seed: 1,
    motionProfile: CurveCrawlerMotionProfile.Autonomous,
    initialPopulationCount: 1,
  });
  private readonly evaluator: CurveCrawlerMeshEvaluator;
  private readonly streams: VertexStreams;
  private readonly savedEggPositions: Float32Array;
  private readonly savedEggNormals: Float32Array;

  constructor(private readonly plan: CurveCrawlerMeshPlan) {
    this.evaluator = new CurveCrawlerMeshEvaluator(plan);
    this.streams = Object.freeze({
      positions: new Float32Array(plan.vertexCount * 3),
      normals: new Float32Array(plan.vertexCount * 3),
      colors: new Float32Array(plan.vertexCount * 4),
    });
    this.savedEggPositions = new Float32Array(plan.emergence.eggVertexCount * 3);
    this.savedEggNormals = new Float32Array(plan.emergence.eggVertexCount * 3);
  }

  /** 把源实体的固定形态编译到目标共享顶点槽位。 */
  public write(
    source: CurveCrawlerState,
    entityIndex: number,
    target: VertexStreams,
    targetEntitySlot: number,
  ): void {
    if (!Number.isInteger(entityIndex) || entityIndex < 0 || entityIndex >= source.count
      || !Number.isInteger(targetEntitySlot) || targetEntitySlot < 0) {
      throw new Error('Curve Crawler GPU Bind Pose 写入范围无效。');
    }
    this.prepareCanonicalState(source, entityIndex);
    this.evaluate(MonsterLifecycleState.Alive);

    const animation = this.state.data.animation;
    animation.liquidSpread[0] = 1;
    this.evaluate(MonsterLifecycleState.Dying);

    animation.crackSpread[0] = 1;
    animation.crackVisibility[0] = 1;
    animation.eggScale[0] = 1;
    animation.eggBulge[0] = 0;
    animation.eggBurst[0] = 0;
    this.evaluate(MonsterLifecycleState.Spawning);
    this.captureEgg();

    animation.eggBurst[0] = 0.5;
    this.evaluate(MonsterLifecycleState.Spawning);
    this.restoreEgg();

    const targetVertexOffset = targetEntitySlot * this.plan.vertexCount;
    assertTargetCapacity(target, targetVertexOffset + this.plan.vertexCount);
    target.positions.set(this.streams.positions, targetVertexOffset * 3);
    target.normals.set(this.streams.normals, targetVertexOffset * 3);
    target.colors.set(this.streams.colors, targetVertexOffset * 4);
  }

  private prepareCanonicalState(source: CurveCrawlerState, entityIndex: number): void {
    const sourceData = source.data;
    const targetData = this.state.data;
    targetData.identity.appearanceSeed[0] = sourceData.identity.appearanceSeed[entityIndex] ?? 1;
    targetData.transform.x[0] = 0;
    targetData.transform.y[0] = 0;
    targetData.transform.heading[0] = 0;
    targetData.transform.headingCosine[0] = 1;
    targetData.transform.headingSine[0] = 0;
    targetData.morphology.bodyLength[0] = sourceData.morphology.bodyLength[entityIndex] ?? 0;
    targetData.morphology.bodyWidth[0] = sourceData.morphology.bodyWidth[entityIndex] ?? 0;
    targetData.morphology.legLength[0] = sourceData.morphology.legLength[entityIndex] ?? 0;
    targetData.morphology.legWidth[0] = sourceData.morphology.legWidth[entityIndex] ?? 0;
    targetData.morphology.eyeRadius[0] = sourceData.morphology.eyeRadius[entityIndex] ?? 0;
    for (let ray = 0; ray < CURVE_CRAWLER_LIQUID_RAY_COUNT; ray++) {
      targetData.morphology.liquidRadiusScales[ray] =
        sourceData.morphology.liquidRadiusScales[
          entityIndex * CURVE_CRAWLER_LIQUID_RAY_COUNT + ray
        ] ?? 1;
    }

    const animation = targetData.animation;
    animation.phase[0] = 0;
    animation.bodyPulse[0] = 0;
    animation.crouchAmount[0] = 0;
    animation.biteAmount[0] = 0;
    animation.turnAmount[0] = 0;
    animation.turnDirection[0] = 1;
    animation.blinkScale[0] = 1;
    animation.hitFlash[0] = 0;
    animation.crackSpread[0] = 0;
    animation.crackVisibility[0] = 0;
    animation.eggScale[0] = 0;
    animation.eggBulge[0] = 0;
    animation.eggBurst[0] = 0;
    animation.emergenceBodyScale[0] = 1;
    animation.emergenceLegScale[0] = 1;
    animation.surfaceCollapse[0] = 0;
    animation.liquidSpread[0] = 0;
    animation.liquidDrain[0] = 0;
    for (let leg = 0; leg < CURVE_CRAWLER_LEG_COUNT; leg++) {
      animation.legPhaseCosines[leg] = 0;
      animation.legPhaseSines[leg] = 0;
    }
    for (let fragment = 0; fragment < CURVE_CRAWLER_FRAGMENT_COUNT; fragment++) {
      animation.fragmentOffsetX[fragment] = 0;
      animation.fragmentOffsetY[fragment] = 0;
      animation.fragmentOffsetZ[fragment] = 0;
      animation.fragmentRotation[fragment] = 0;
    }
  }

  private evaluate(lifecycle: MonsterLifecycleState): void {
    this.state.data.vitality.state[0] = lifecycle;
    this.evaluator.evaluate(
      this.state,
      this.plan,
      this.streams,
      createEntityRange(0, 1, 1),
      MeshDirty.Pose | MeshDirty.Color,
    );
  }

  private captureEgg(): void {
    const firstVertex = this.plan.emergence.vertexOffset
      + this.plan.emergence.eggVertexOffset;
    const firstComponent = firstVertex * 3;
    const componentCount = this.plan.emergence.eggVertexCount * 3;
    this.savedEggPositions.set(
      this.streams.positions.subarray(firstComponent, firstComponent + componentCount),
    );
    this.savedEggNormals.set(
      this.streams.normals.subarray(firstComponent, firstComponent + componentCount),
    );
  }

  private restoreEgg(): void {
    const firstVertex = this.plan.emergence.vertexOffset
      + this.plan.emergence.eggVertexOffset;
    this.streams.positions.set(this.savedEggPositions, firstVertex * 3);
    this.streams.normals.set(this.savedEggNormals, firstVertex * 3);
  }
}

function assertTargetCapacity(streams: VertexStreams, vertexCount: number): void {
  if (streams.positions.length < vertexCount * 3
    || streams.normals.length < vertexCount * 3
    || streams.colors.length < vertexCount * 4) {
    throw new Error('Curve Crawler GPU Bind Pose 目标流容量不足。');
  }
}
