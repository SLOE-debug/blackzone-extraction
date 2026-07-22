import { MonsterLifecycleState } from '../../../../../core/contracts/monster-lifecycle';
import { type CurveCrawlerMeshPlan } from '../geometry/curve-crawler-mesh-plan';
import { type CurveCrawlerState } from '../model/curve-crawler-state';
import { type CurveCrawlerResidentLayout } from './curve-crawler-resident-layout';

const BODY_VISIBLE = 1 << 0;
const CRACK_VISIBLE = 1 << 1;
const EGG_VISIBLE = 1 << 2;
const SHARDS_VISIBLE = 1 << 3;
const LIQUID_VISIBLE = 1 << 4;

/** 活动索引布局读取的单个共享人口。 */
export interface CurveCrawlerActiveIndexSource {
  readonly renderIdentity: number;
  readonly state: CurveCrawlerState;
  readonly residents: CurveCrawlerResidentLayout;
}

/**
 * 把驻留蜘蛛当前真正需要的身体、出生与死亡拓扑压到索引缓冲前缀。
 *
 * 顶点槽位仍保持固定计划，GPU 三角形提交只按生命周期精确收缩。
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
        const mask = resolveTopologyMask(
          source.state,
          entityIndex,
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

function resolveTopologyMask(
  state: CurveCrawlerState,
  entityIndex: number,
): number {
  const lifecycle = state.data.vitality.state[entityIndex] as MonsterLifecycleState;
  if (lifecycle === MonsterLifecycleState.Alive) {
    return BODY_VISIBLE;
  }
  if (lifecycle === MonsterLifecycleState.Dying) {
    return BODY_VISIBLE | LIQUID_VISIBLE;
  }
  if (lifecycle !== MonsterLifecycleState.Spawning) {
    throw new Error('Curve Crawler 活动索引收到了非驻留生命周期。');
  }
  const animation = state.data.animation;
  let mask = 0;
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
): number {
  return appendIndexRange(
    plan,
    target,
    targetOffset,
    vertexOffset,
    0,
    plan.body.indexCount + plan.eyes.indexCount,
  );
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
