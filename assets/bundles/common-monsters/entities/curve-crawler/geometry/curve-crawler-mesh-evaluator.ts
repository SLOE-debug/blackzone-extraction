import { type EntityRange } from '../../../../../core/entities/entity-range';
import { MonsterLifecycleState } from '../../../../../core/contracts/monster-lifecycle';
import { MeshDirty } from '../../../../../core/mesh/mesh-dirty';
import { type MeshEvaluator } from '../../../../../core/mesh/mesh-evaluator';
import { type VertexStreams } from '../../../../../core/mesh/vertex-streams';
import { type CurveCrawlerState } from '../model/curve-crawler-state';
import {
  evaluateCurveCrawlerBodyMesh,
  createCurveCrawlerLegScratch,
  type MutableCurveCrawlerLegScratch,
} from './curve-crawler-body-mesh-evaluator';
import { collapseCurveCrawlerBodyAndEyes } from './curve-crawler-mesh-collapse';
import { evaluateCurveCrawlerColors } from './curve-crawler-mesh-colors';
import { evaluateCurveCrawlerEyeMesh } from './curve-crawler-eye-mesh-evaluator';
import { evaluateCurveCrawlerLiquidMesh } from './curve-crawler-liquid-mesh-evaluator';
import { type CurveCrawlerMeshPlan } from './curve-crawler-mesh-plan';
import { CurveCrawlerPackedMeshUpdate } from './curve-crawler-packed-mesh-update';
import { curveCrawlerMeshPlan } from './curve-crawler-mesh-compiler';
import {
  createCurveCrawlerEmergenceScratch,
  evaluateCurveCrawlerEmergenceMesh,
  type CurveCrawlerEmergenceScratch,
} from './curve-crawler-emergence-mesh-evaluator';

/**
 * 将 Curve Crawler 当前 SoA 状态直接求值到编译式动态顶点流。
 *
 * 此类不持有 Cocos 资源、不构造 TriangleMeshWriter，也不会在运行期改写固定索引。
 */
export class CurveCrawlerMeshEvaluator
implements MeshEvaluator<CurveCrawlerState, CurveCrawlerMeshPlan> {
  /** 八条腿顺序复用的一份控制点缓存，避免高频对象分配。 */
  private readonly legScratch: MutableCurveCrawlerLegScratch;
  /** 蛋壳三角面和爆裂碎片顺序复用的出生几何缓存。 */
  private readonly emergenceScratch: CurveCrawlerEmergenceScratch
    = createCurveCrawlerEmergenceScratch();

  constructor(
    plan: CurveCrawlerMeshPlan,
    private readonly writeNormals = true,
  ) {
    this.legScratch = createCurveCrawlerLegScratch(plan.legTube);
  }

  /**
   * 按请求的流位标志原地求值指定连续实体范围。
   *
   * @param state 当前 Curve Crawler 群体状态。
   * @param plan 全部实体共享的单实体局部固定拓扑计划。
   * @param streams 当前批次有效范围的动态顶点流。
   * @param range 当前批次在领域 SoA 中覆盖的连续实体范围。
   * @param requested 调用方允许改写的顶点流和包围盒位标志。
   * @returns 实际改写的流位标志。
   */
  public evaluate(
    state: CurveCrawlerState,
    plan: CurveCrawlerMeshPlan,
    streams: VertexStreams,
    range: EntityRange,
    requested: MeshDirty,
  ): MeshDirty {
    const flags = resolveEvaluationFlags(requested, this.writeNormals);
    const writeGeometry = (flags & CurveCrawlerEvaluationFlag.Geometry) !== 0;
    const writeColors = (flags & CurveCrawlerEvaluationFlag.Color) !== 0;
    if (!writeGeometry
      && !writeColors
      && (requested & MeshDirty.Bounds) === 0) {
      return MeshDirty.None;
    }
    assertCurveCrawlerStreamCapacity(plan, streams, range.count, this.writeNormals);

    for (let localEntity = 0; localEntity < range.count; localEntity++) {
      const entityIndex = range.start + localEntity;
      const entityVertexOffset = localEntity * plan.vertexCount;
      this.evaluateEntity(
        state,
        plan,
        streams,
        entityIndex,
        entityVertexOffset,
        writeGeometry,
        writeColors,
        this.writeNormals,
      );
    }

    return createChangedFlags(requested, writeGeometry, writeColors, this.writeNormals);
  }

  /**
   * 把任意 SoA 槽位清单紧凑写入目标网格的连续实体区段。
   *
   * @param entityIndices 按输出顺序排列的源实体槽位。
   * @param entityCount 本次读取的清单有效数量。
   * @param targetEntityOffset 目标网格中的首个紧凑实体槽位。
   */
  public evaluatePacked(
    state: CurveCrawlerState,
    plan: CurveCrawlerMeshPlan,
    streams: VertexStreams,
    entityIndices: Uint32Array,
    entityCount: number,
    targetEntityOffset: number,
    requested: MeshDirty,
  ): MeshDirty {
    if (!Number.isInteger(entityCount)
      || entityCount < 0
      || entityCount > entityIndices.length
      || !Number.isInteger(targetEntityOffset)
      || targetEntityOffset < 0) {
      throw new Error('Curve Crawler 紧凑求值范围无效。');
    }
    const flags = resolveEvaluationFlags(requested, this.writeNormals);
    const writeGeometry = (flags & CurveCrawlerEvaluationFlag.Geometry) !== 0;
    const writeColors = (flags & CurveCrawlerEvaluationFlag.Color) !== 0;
    if (!writeGeometry
      && !writeColors
      && (requested & MeshDirty.Bounds) === 0) {
      return MeshDirty.None;
    }
    assertCurveCrawlerStreamCapacity(
      plan,
      streams,
      targetEntityOffset + entityCount,
      this.writeNormals,
    );
    for (let packedIndex = 0; packedIndex < entityCount; packedIndex++) {
      const entityIndex = entityIndices[packedIndex];
      if (entityIndex === undefined || entityIndex >= state.count) {
        throw new Error('Curve Crawler 紧凑求值清单包含越界实体槽位。');
      }
      this.evaluateEntity(
        state,
        plan,
        streams,
        entityIndex,
        (targetEntityOffset + packedIndex) * plan.vertexCount,
        writeGeometry,
        writeColors,
        this.writeNormals,
      );
    }
    return createChangedFlags(requested, writeGeometry, writeColors, this.writeNormals);
  }

  /**
   * 按单实体脏区命令求值共享 Unlit 批次。
   *
   * Position 命令不计算 CPU 法线与颜色；Shaded 命令只重算发生颜色档位变化的
   * 实体，供调用方随后烘焙该实体的分面明暗。
   */
  public evaluatePackedScheduled(
    state: CurveCrawlerState,
    plan: CurveCrawlerMeshPlan,
    streams: VertexStreams,
    entityIndices: Uint32Array,
    updates: Uint8Array,
    entityCount: number,
    targetEntityOffset: number,
  ): MeshDirty {
    if (!Number.isInteger(entityCount)
      || entityCount < 0
      || entityCount > entityIndices.length
      || entityCount > updates.length
      || !Number.isInteger(targetEntityOffset)
      || targetEntityOffset < 0) {
      throw new Error('Curve Crawler 脏区紧凑求值范围无效。');
    }
    assertCurveCrawlerStreamCapacity(
      plan,
      streams,
      targetEntityOffset + entityCount,
      true,
    );
    let changed = MeshDirty.None;
    for (let packedIndex = 0; packedIndex < entityCount; packedIndex++) {
      const update = updates[packedIndex] as CurveCrawlerPackedMeshUpdate;
      if (update === CurveCrawlerPackedMeshUpdate.None) {
        continue;
      }
      const entityIndex = entityIndices[packedIndex];
      if (entityIndex === undefined || entityIndex >= state.count
        || update < CurveCrawlerPackedMeshUpdate.Position
        || update > CurveCrawlerPackedMeshUpdate.Shaded) {
        throw new Error('Curve Crawler 脏区紧凑求值命令无效。');
      }
      const shaded = update === CurveCrawlerPackedMeshUpdate.Shaded;
      this.evaluateEntity(
        state,
        plan,
        streams,
        entityIndex,
        (targetEntityOffset + packedIndex) * plan.vertexCount,
        true,
        shaded,
        shaded,
      );
      changed |= MeshDirty.Position;
      if (shaded) {
        changed |= MeshDirty.Color;
      }
    }
    return changed;
  }

  /** 将一个源实体求值到指定的目标顶点区段。 */
  private evaluateEntity(
    state: CurveCrawlerState,
    plan: CurveCrawlerMeshPlan,
    streams: VertexStreams,
    entityIndex: number,
    entityVertexOffset: number,
    writeGeometry: boolean,
    writeColors: boolean,
    writeNormals: boolean,
  ): void {
    if (writeGeometry) {
      const lifecycle = state.data.vitality.state[entityIndex] as MonsterLifecycleState;
      const bodyVisible = lifecycle !== MonsterLifecycleState.Spawning
        || (state.data.animation.emergenceBodyScale[entityIndex] ?? 0) > 0.001;
      if (bodyVisible) {
        const surfaceCollapse = state.data.animation.surfaceCollapse[entityIndex] ?? 0;
        if (surfaceCollapse >= 0.999) {
          collapseCurveCrawlerBodyAndEyes(
            plan,
            streams,
            entityVertexOffset,
            state.data.transform.x[entityIndex] ?? 0,
            state.data.transform.y[entityIndex] ?? 0,
            true,
            writeNormals,
          );
        } else {
          const fragmentScale = Math.max(0.0001, 1 - surfaceCollapse);
          evaluateCurveCrawlerBodyMesh(
            state,
            plan,
            entityIndex,
            entityVertexOffset,
            fragmentScale,
            streams,
            true,
            writeNormals,
            this.legScratch,
          );
          evaluateCurveCrawlerEyeMesh(
            state,
            plan,
            entityIndex,
            entityVertexOffset,
            fragmentScale,
            streams,
            true,
            writeNormals,
          );
        }
      }
      if (lifecycle === MonsterLifecycleState.Dying) {
        evaluateCurveCrawlerLiquidMesh(
          state,
          plan,
          entityIndex,
          entityVertexOffset,
          streams,
          true,
          writeNormals,
        );
      } else if (lifecycle === MonsterLifecycleState.Spawning) {
        evaluateCurveCrawlerEmergenceMesh(
          state,
          plan,
          entityIndex,
          entityVertexOffset,
          streams,
          true,
          writeNormals,
          this.emergenceScratch,
        );
      }
    }
    if (writeColors) {
      evaluateCurveCrawlerColors(
        state,
        plan,
        entityIndex,
        entityVertexOffset,
        streams.colors,
      );
    }
  }
}

const enum CurveCrawlerEvaluationFlag {
  None = 0,
  Geometry = 1 << 0,
  Color = 1 << 1,
}

/** 验证成对姿态流并解析本次实际需要改写的属性。 */
function resolveEvaluationFlags(
  requested: MeshDirty,
  writeNormals: boolean,
): CurveCrawlerEvaluationFlag {
  const requestedPose = requested & MeshDirty.Pose;
  if (writeNormals
    && requestedPose !== MeshDirty.None
    && requestedPose !== MeshDirty.Pose) {
    throw new Error('Curve Crawler 的 Position 和 Normal 必须作为同一姿态成对请求。');
  }
  if (!writeNormals && (requested & MeshDirty.Normal) !== 0) {
    throw new Error('Curve Crawler Unlit 批次不能请求不存在的 Normal 流。');
  }
  let flags = CurveCrawlerEvaluationFlag.None;
  if ((writeNormals && requestedPose === MeshDirty.Pose)
    || (!writeNormals && (requested & MeshDirty.Position) !== 0)) {
    flags |= CurveCrawlerEvaluationFlag.Geometry;
  }
  if ((requested & MeshDirty.Color) !== 0) {
    flags |= CurveCrawlerEvaluationFlag.Color;
  }
  return flags;
}

/** 把已经执行的求值职责转换回通用脏标志。 */
function createChangedFlags(
  requested: MeshDirty,
  writeGeometry: boolean,
  writeColors: boolean,
  writeNormals: boolean,
): MeshDirty {
  let changed = MeshDirty.None;
  if (writeGeometry) {
    changed |= writeNormals ? MeshDirty.Pose : MeshDirty.Position;
  }
  if (writeColors) {
    changed |= MeshDirty.Color;
  }
  if ((requested & MeshDirty.Bounds) !== 0) {
    changed |= MeshDirty.Bounds;
  }
  return changed;
}

/** 验证当前批次顶点流至少完整覆盖其连续实体范围。 */
function assertCurveCrawlerStreamCapacity(
  plan: CurveCrawlerMeshPlan,
  streams: VertexStreams,
  entityCount: number,
  requireNormals: boolean,
): void {
  const vertexCount = plan.vertexCount * entityCount;
  if (streams.positions.length < vertexCount * 3
    || (requireNormals && streams.normals.length < vertexCount * 3)
    || streams.colors.length < vertexCount * 4) {
    throw new Error('Curve Crawler 动态顶点流容量不足。');
  }
}

/** Curve Crawler 全部编译式批次共享的无状态求值器。 */
export const curveCrawlerMeshEvaluator = new CurveCrawlerMeshEvaluator(curveCrawlerMeshPlan);
