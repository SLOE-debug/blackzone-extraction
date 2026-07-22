import { MonsterLifecycleState } from '../../../../../core/contracts/monster-lifecycle';
import { PlanarVisibilityDetail } from '../../../../../core/contracts/planar-circle-visibility';
import { type CurveCrawlerMeshPlan } from '../geometry/curve-crawler-mesh-plan';
import { type CurveCrawlerState } from '../model/curve-crawler-state';
import {
  CURVE_CRAWLER_MINIMAL_LEGS,
  CURVE_CRAWLER_REDUCED_LEGS,
} from '../model/curve-crawler-detail-level';
import { type CurveCrawlerResidentLayout } from './curve-crawler-resident-layout';

const DETAIL_MASK = 0b00000011;
const BODY_VISIBLE = 1 << 2;
const CRACK_VISIBLE = 1 << 3;
const EGG_VISIBLE = 1 << 4;
const SHARDS_VISIBLE = 1 << 5;
const LIQUID_VISIBLE = 1 << 6;

/** 活动索引布局读取的单个共享人口。 */
export interface CurveCrawlerActiveIndexSource {
  readonly renderIdentity: number;
  readonly state: CurveCrawlerState;
  readonly residents: CurveCrawlerResidentLayout;
}

/**
 * 把可见蜘蛛当前真正需要的身体、出生与死亡拓扑压到索引缓冲前缀。
 *
 * 顶点槽位仍保持固定计划，只有 GPU 三角形提交按生命周期和距离 LOD 精确收缩。
 */
export class CurveCrawlerActiveIndexLayout {
  private entryIds = new Uint32Array(0);
  private entityIds = new Uint32Array(0);
  private topologyMasks = new Uint8Array(0);
  private trackedEntityCount = 0;
  private currentIndexCount = 0;

  constructor(private readonly plan: CurveCrawlerMeshPlan) {}

  public get indexCount(): number {
    return this.currentIndexCount;
  }

  /** 同步拓扑身份；发生变化时重写索引前缀并返回 true。 */
  public synchronize(
    sources: readonly CurveCrawlerActiveIndexSource[],
    target: Uint32Array,
    entityCapacity: number,
    force: boolean,
  ): boolean {
    if (!Number.isInteger(entityCapacity) || entityCapacity <= 0) {
      throw new Error('Curve Crawler 活动索引容量必须是正整数。');
    }
    if (target.length < this.plan.indexCount * entityCapacity) {
      throw new Error('Curve Crawler 活动索引目标容量不足。');
    }
    if (this.entryIds.length < entityCapacity) {
      this.entryIds = new Uint32Array(entityCapacity);
      this.entityIds = new Uint32Array(entityCapacity);
      this.topologyMasks = new Uint8Array(entityCapacity);
      force = true;
    }

    let packedEntity = 0;
    let changed = force;
    for (const source of sources) {
      const residents = source.residents;
      for (let packedIndex = 0; packedIndex < residents.count; packedIndex++) {
        const entityIndex = residents.entityIndices[packedIndex];
        if (entityIndex === undefined || entityIndex >= source.state.count) {
          throw new Error('Curve Crawler 活动索引包含越界实体。');
        }
        const detailValue = residents.detailLevels[packedIndex];
        if (detailValue === undefined) {
          throw new Error('Curve Crawler 活动索引缺少细节档位。');
        }
        const mask = resolveTopologyMask(
          source.state,
          entityIndex,
          detailValue as PlanarVisibilityDetail,
        );
        if ((this.entryIds[packedEntity] ?? 0) !== source.renderIdentity
          || (this.entityIds[packedEntity] ?? 0) !== entityIndex
          || (this.topologyMasks[packedEntity] ?? 0) !== mask) {
          changed = true;
        }
        this.entryIds[packedEntity] = source.renderIdentity;
        this.entityIds[packedEntity] = entityIndex;
        this.topologyMasks[packedEntity] = mask;
        packedEntity++;
      }
    }
    if (packedEntity !== this.trackedEntityCount) {
      changed = true;
    }
    this.trackedEntityCount = packedEntity;
    if (!changed) {
      return false;
    }

    let targetIndexOffset = 0;
    for (let entity = 0; entity < packedEntity; entity++) {
      const vertexOffset = entity * this.plan.vertexCount;
      const mask = this.topologyMasks[entity] ?? 0;
      if ((mask & BODY_VISIBLE) !== 0) {
        targetIndexOffset = appendBodyIndices(
          this.plan,
          target,
          targetIndexOffset,
          vertexOffset,
          (mask & DETAIL_MASK) as PlanarVisibilityDetail,
        );
      }
      if ((mask & CRACK_VISIBLE) !== 0) {
        targetIndexOffset = appendIndexRange(
          this.plan,
          target,
          targetIndexOffset,
          vertexOffset,
          this.plan.emergence.indexOffset + this.plan.emergence.crackIndexOffset,
          this.plan.emergence.crackIndexCount,
        );
      }
      if ((mask & EGG_VISIBLE) !== 0) {
        targetIndexOffset = appendIndexRange(
          this.plan,
          target,
          targetIndexOffset,
          vertexOffset,
          this.plan.emergence.indexOffset + this.plan.emergence.eggIndexOffset,
          this.plan.emergence.eggIndexCount,
        );
      }
      if ((mask & SHARDS_VISIBLE) !== 0) {
        targetIndexOffset = appendIndexRange(
          this.plan,
          target,
          targetIndexOffset,
          vertexOffset,
          this.plan.emergence.indexOffset + this.plan.emergence.shardIndexOffset,
          this.plan.emergence.shardIndexCount,
        );
      }
      if ((mask & LIQUID_VISIBLE) !== 0) {
        targetIndexOffset = appendIndexRange(
          this.plan,
          target,
          targetIndexOffset,
          vertexOffset,
          this.plan.liquid.indexOffset,
          this.plan.liquidFan.indexCount,
        );
      }
    }
    this.currentIndexCount = targetIndexOffset;
    return true;
  }
}

/** 返回一个存活实体在指定 LOD 下实际提交的身体索引数量。 */
export function getCurveCrawlerBodyLodIndexCount(
  plan: CurveCrawlerMeshPlan,
  detail: PlanarVisibilityDetail,
): number {
  if (detail === PlanarVisibilityDetail.Full) {
    return plan.body.indexCount + plan.eyes.indexCount;
  }
  const legCount = detail === PlanarVisibilityDetail.Reduced
    ? CURVE_CRAWLER_REDUCED_LEGS.length
    : CURVE_CRAWLER_MINIMAL_LEGS.length;
  return legCount * getReducedLegIndexCount(plan)
    + plan.bodyEllipsoid.indexCount * 2
    + plan.eyes.indexCount;
}

function resolveTopologyMask(
  state: CurveCrawlerState,
  entityIndex: number,
  detail: PlanarVisibilityDetail,
): number {
  const lifecycle = state.data.vitality.state[entityIndex] as MonsterLifecycleState;
  if (lifecycle === MonsterLifecycleState.Alive) {
    return detail | BODY_VISIBLE;
  }
  if (lifecycle === MonsterLifecycleState.Dying) {
    return detail | BODY_VISIBLE | LIQUID_VISIBLE;
  }
  if (lifecycle !== MonsterLifecycleState.Spawning) {
    throw new Error('Curve Crawler 活动索引收到了非驻留生命周期。');
  }
  const animation = state.data.animation;
  let mask = detail;
  if ((animation.emergenceBodyScale[entityIndex] ?? 0) > 0.001) {
    mask |= BODY_VISIBLE;
  }
  if ((animation.crackVisibility[entityIndex] ?? 0) > 0.001) {
    mask |= CRACK_VISIBLE;
  }
  const eggScale = animation.eggScale[entityIndex] ?? 0;
  const eggBurst = animation.eggBurst[entityIndex] ?? 0;
  if (eggScale > 0.001 && eggBurst < 0.999) {
    mask |= EGG_VISIBLE;
  }
  if (eggBurst > 0.001 && eggBurst < 0.999) {
    mask |= SHARDS_VISIBLE;
  }
  return mask;
}

function appendBodyIndices(
  plan: CurveCrawlerMeshPlan,
  target: Uint32Array,
  targetOffset: number,
  vertexOffset: number,
  detail: PlanarVisibilityDetail,
): number {
  if (detail === PlanarVisibilityDetail.Full) {
    return appendIndexRange(
      plan,
      target,
      targetOffset,
      vertexOffset,
      0,
      plan.body.indexCount + plan.eyes.indexCount,
    );
  }
  const legs = detail === PlanarVisibilityDetail.Reduced
    ? CURVE_CRAWLER_REDUCED_LEGS
    : CURVE_CRAWLER_MINIMAL_LEGS;
  let cursor = targetOffset;
  for (const leg of legs) {
    cursor = appendReducedLegIndices(
      plan,
      target,
      cursor,
      vertexOffset,
      leg,
    );
  }
  cursor = appendIndexRange(
    plan,
    target,
    cursor,
    vertexOffset,
    plan.body.abdomenIndexOffset,
    plan.bodyEllipsoid.indexCount,
  );
  cursor = appendIndexRange(
    plan,
    target,
    cursor,
    vertexOffset,
    plan.body.thoraxIndexOffset,
    plan.bodyEllipsoid.indexCount,
  );
  return appendIndexRange(
    plan,
    target,
    cursor,
    vertexOffset,
    plan.eyes.indexOffset,
    plan.eyes.indexCount,
  );
}

/** 远距腿每个管壁四边形只保留一枚交错三角形，覆盖各朝向并砍掉一半面数。 */
function appendReducedLegIndices(
  plan: CurveCrawlerMeshPlan,
  target: Uint32Array,
  targetOffset: number,
  vertexOffset: number,
  leg: number,
): number {
  const legIndexOffset = plan.body.legIndexOffsets[leg] ?? 0;
  let cursor = targetOffset;
  for (let segment = 0; segment < plan.legTube.segmentCount; segment++) {
    const segmentOffset = legIndexOffset + segment * plan.legTube.radialCount * 6;
    for (let radial = 0; radial < plan.legTube.radialCount; radial++) {
      const triangleOffset = ((segment + radial) & 1) * 3;
      cursor = appendIndexRange(
        plan,
        target,
        cursor,
        vertexOffset,
        segmentOffset + radial * 6 + triangleOffset,
        3,
      );
    }
  }
  return cursor;
}

function getReducedLegIndexCount(plan: CurveCrawlerMeshPlan): number {
  return plan.legTube.segmentCount * plan.legTube.radialCount * 3;
}

function appendIndexRange(
  plan: CurveCrawlerMeshPlan,
  target: Uint32Array,
  targetOffset: number,
  vertexOffset: number,
  sourceOffset: number,
  indexCount: number,
): number {
  const end = sourceOffset + indexCount;
  for (let sourceIndex = sourceOffset; sourceIndex < end; sourceIndex++) {
    target[targetOffset++] = (plan.indices[sourceIndex] ?? 0) + vertexOffset;
  }
  return targetOffset;
}
