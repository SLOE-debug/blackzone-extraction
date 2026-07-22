import { PlanarCrowdCandidateBuffer } from '../../../core/monsters/crowd/planar-crowd-candidate-buffer';
import { type PlanarCrowdSeparationSystem } from '../../../core/monsters/crowd/planar-crowd-separation-system';
import { BATTLEFIELD_MONSTER_SPAWN } from '../model/battlefield-monster-spawn';
import {
  BattlefieldPenetratingHitBuffer,
  type BattlefieldPenetratingHitQuery,
  validateBattlefieldPenetratingHitQuery,
} from './battlefield-penetrating-hit';
import {
  type MutableBattlefieldAimTarget,
  type MutableBattlefieldProjectileHit,
} from './battlefield-monster-contracts';
import { type BattlefieldMonsterTargetGroup } from './battlefield-monster-target-group';

const MAXIMUM_CROWD_CANDIDATES = 512;
const MAXIMUM_AIM_DISTANCE = 26;

/** 聚合异构怪物群的辅助瞄准与共享空间索引命中路由。 */
export class BattlefieldMonsterTargetRegistry {
  private readonly groups: BattlefieldMonsterTargetGroup[] = [];
  private readonly candidates = new PlanarCrowdCandidateBuffer(MAXIMUM_CROWD_CANDIDATES);
  private readonly aimCandidate: MutableBattlefieldAimTarget = { x: 0, y: 0, z: 0 };
  private readonly hitCandidate: MutableBattlefieldProjectileHit = {
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
    automatic: boolean,
    result: MutableBattlefieldAimTarget,
  ): boolean {
    let found = false;
    let bestScore = Number.POSITIVE_INFINITY;
    const inverseScale = 1 / BATTLEFIELD_MONSTER_SPAWN.modelScale;
    this.crowd.collectCircleCandidates(
      originX * inverseScale,
      -originZ * inverseScale,
      MAXIMUM_AIM_DISTANCE * inverseScale,
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
        automatic,
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
      const score = 1 - alignment + distance / MAXIMUM_AIM_DISTANCE * 0.08;
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

  /** 一次遍历共享空间索引，按进度排序去重后依次结算衰减伤害。 */
  public damageAlongSegment(
    query: Readonly<BattlefieldPenetratingHitQuery>,
    hits: BattlefieldPenetratingHitBuffer,
  ): number {
    validateBattlefieldPenetratingHitQuery(query, hits.capacity);
    hits.reset();
    const inverseScale = 1 / BATTLEFIELD_MONSTER_SPAWN.modelScale;
    this.crowd.collectSegmentCandidates(
      query.startX * inverseScale,
      -query.startZ * inverseScale,
      query.endX * inverseScale,
      -query.endZ * inverseScale,
      query.impactRadius * inverseScale,
      this.candidates,
    );
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
      hits.include(
        populationId,
        this.hitCandidate.entityId,
        this.hitCandidate.x,
        this.hitCandidate.y,
        this.hitCandidate.z,
        this.hitCandidate.segmentProgress,
      );
    }
    const hitCount = Math.min(hits.count, query.maximumHitCount);
    let retainedDamage = query.damage;
    for (let index = 0; index < hitCount; index++) {
      this.findGroup(hits.populationIds[index] ?? 0)?.damageMonster(
        hits.entityIds[index] ?? 0,
        retainedDamage,
      );
      retainedDamage *= query.damageRetention;
    }
    return hitCount;
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
