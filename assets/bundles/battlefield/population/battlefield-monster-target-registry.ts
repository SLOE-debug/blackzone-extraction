import { PlanarCrowdCandidateBuffer } from '../../../core/monsters/crowd/planar-crowd-candidate-buffer';
import { type PlanarCrowdSeparationSystem } from '../../../core/monsters/crowd/planar-crowd-separation-system';
import { BATTLEFIELD_MONSTER_SPAWN } from '../model/battlefield-monster-spawn';
import {
  type BattlefieldProjectileSweepQuery,
  type MutableBattlefieldAimTarget,
  type MutableBattlefieldProjectileHit,
} from './battlefield-monster-contracts';
import { type BattlefieldMonsterTargetGroup } from './battlefield-monster-target-group';
import { BATTLEFIELD_AIM_ASSIST } from '../combat/battlefield-aim-assist';
import {
  type MutableBattlefieldProjectileStatistics,
} from '../equipment/projectile/model/battlefield-projectile-statistics';

const MAXIMUM_CROWD_CANDIDATES = 512;

/** 聚合异构怪物群的辅助瞄准与共享空间索引命中路由。 */
export class BattlefieldMonsterTargetRegistry {
  private readonly groups: BattlefieldMonsterTargetGroup[] = [];
  private readonly candidates = new PlanarCrowdCandidateBuffer(MAXIMUM_CROWD_CANDIDATES);
  private readonly aimCandidate: MutableBattlefieldAimTarget = { x: 0, y: 0, z: 0 };
  private readonly hitCandidate: MutableBattlefieldProjectileHit = {
    populationId: 0,
    entityId: -1,
    x: 0,
    y: 0,
    z: 0,
    segmentProgress: 0,
  };

  constructor(private readonly crowd: PlanarCrowdSeparationSystem) {}

  public register(group: BattlefieldMonsterTargetGroup): void {
    if (this.groups.includes(group)
      || this.groups.some((entry) => entry.populationId === group.populationId)) {
      throw new Error('怪物目标群或其 Crowd 标识不能重复登记。');
    }
    this.groups.push(group);
  }

  public unregister(group: BattlefieldMonsterTargetGroup): void {
    const index = this.groups.indexOf(group);
    if (index >= 0) {
      this.groups.splice(index, 1);
    }
  }

  public resolveAimTarget(
    originX: number,
    originZ: number,
    directionX: number,
    directionZ: number,
    result: MutableBattlefieldAimTarget,
  ): boolean {
    let found = false;
    let bestScore = Number.POSITIVE_INFINITY;
    const inverseScale = 1 / BATTLEFIELD_MONSTER_SPAWN.modelScale;
    this.crowd.collectCircleCandidates(
      originX * inverseScale,
      -originZ * inverseScale,
      BATTLEFIELD_AIM_ASSIST.maximumDistance * inverseScale,
      this.candidates,
    );
    for (let index = 0; index < this.candidates.count; index++) {
      const group = this.findGroup(this.candidates.populationIds[index] ?? 0);
      if (group === null || !group.writeAimTargetForEntity(
        this.candidates.entityIndices[index] ?? 0,
        originX,
        originZ,
        directionX,
        directionZ,
        this.aimCandidate,
      )) {
        continue;
      }
      const deltaX = this.aimCandidate.x - originX;
      const deltaZ = this.aimCandidate.z - originZ;
      const distanceSquared = deltaX * deltaX + deltaZ * deltaZ;
      const distance = Math.sqrt(distanceSquared);
      const alignment = (deltaX * directionX + deltaZ * directionZ)
        / Math.max(distance, 0.0001);
      const score = 1 - alignment
        + distance / BATTLEFIELD_AIM_ASSIST.maximumDistance * 0.08;
      if (score >= bestScore) {
        continue;
      }
      result.x = this.aimCandidate.x;
      result.y = this.aimCandidate.y;
      result.z = this.aimCandidate.z;
      bestScore = score;
      found = true;
    }
    return found;
  }

  /** 在实体弹丸本帧扫掠路径中返回未命中过的最早目标。 */
  public findFirstProjectileHit(
    query: Readonly<BattlefieldProjectileSweepQuery>,
    ignoredPopulationIds: Uint32Array,
    ignoredEntityIds: Uint32Array,
    ignoredOffset: number,
    ignoredCount: number,
    result: MutableBattlefieldProjectileHit,
    statistics: MutableBattlefieldProjectileStatistics,
  ): boolean {
    validateSweepQuery(query, ignoredPopulationIds, ignoredEntityIds, ignoredOffset, ignoredCount);
    const inverseScale = 1 / BATTLEFIELD_MONSTER_SPAWN.modelScale;
    this.crowd.collectSegmentCandidates(
      query.startX * inverseScale,
      -query.startZ * inverseScale,
      query.endX * inverseScale,
      -query.endZ * inverseScale,
      query.impactRadius * inverseScale,
      this.candidates,
    );
    statistics.broadPhaseCandidates += this.candidates.count;
    let found = false;
    let bestProgress = Number.POSITIVE_INFINITY;
    for (let index = 0; index < this.candidates.count; index++) {
      const populationId = this.candidates.populationIds[index] ?? 0;
      const group = this.findGroup(populationId);
      if (group === null || !group.writeProjectileHitForEntity(
        this.candidates.entityIndices[index] ?? 0,
        query.startX,
        query.startY,
        query.startZ,
        query.endX,
        query.endY,
        query.endZ,
        query.impactRadius,
        this.hitCandidate,
      )) {
        continue;
      }
      statistics.narrowPhaseHits++;
      const entityId = this.hitCandidate.entityId;
      if (isIgnored(
        populationId,
        entityId,
        ignoredPopulationIds,
        ignoredEntityIds,
        ignoredOffset,
        ignoredCount,
      ) || this.hitCandidate.segmentProgress >= bestProgress) {
        continue;
      }
      result.populationId = populationId;
      result.entityId = entityId;
      result.x = this.hitCandidate.x;
      result.y = this.hitCandidate.y;
      result.z = this.hitCandidate.z;
      result.segmentProgress = this.hitCandidate.segmentProgress;
      bestProgress = this.hitCandidate.segmentProgress;
      found = true;
    }
    return found;
  }

  /** 按稳定群体标识路由延迟伤害。 */
  public damageMonster(populationId: number, entityId: number, amount: number): boolean {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('实体弹丸伤害必须是有限正数。');
    }
    const group = this.findGroup(populationId);
    if (group === null) {
      return false;
    }
    group.damageMonster(entityId, amount);
    return true;
  }

  private findGroup(populationId: number): BattlefieldMonsterTargetGroup | null {
    for (const group of this.groups) {
      if (group.populationId === populationId) {
        return group;
      }
    }
    return null;
  }
}

function isIgnored(
  populationId: number,
  entityId: number,
  ignoredPopulationIds: Uint32Array,
  ignoredEntityIds: Uint32Array,
  ignoredOffset: number,
  ignoredCount: number,
): boolean {
  for (let index = 0; index < ignoredCount; index++) {
    const offset = ignoredOffset + index;
    if ((ignoredPopulationIds[offset] ?? 0) === populationId
      && (ignoredEntityIds[offset] ?? 0) === entityId) {
      return true;
    }
  }
  return false;
}

function validateSweepQuery(
  query: Readonly<BattlefieldProjectileSweepQuery>,
  ignoredPopulationIds: Uint32Array,
  ignoredEntityIds: Uint32Array,
  ignoredOffset: number,
  ignoredCount: number,
): void {
  if (![query.startX, query.startY, query.startZ, query.endX, query.endY, query.endZ,
    query.impactRadius].every(Number.isFinite)
    || query.impactRadius < 0
    || !Number.isSafeInteger(ignoredOffset) || ignoredOffset < 0
    || !Number.isSafeInteger(ignoredCount) || ignoredCount < 0
    || ignoredOffset + ignoredCount > ignoredPopulationIds.length
    || ignoredOffset + ignoredCount > ignoredEntityIds.length) {
    throw new Error('实体弹丸扫掠查询或命中历史范围无效。');
  }
}
