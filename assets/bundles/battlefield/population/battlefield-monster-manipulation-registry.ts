import {
  CombatTag,
  MonsterBodySize,
} from '../../../core/contracts/monster-manipulation';
import { PlanarCrowdCandidateBuffer } from '../../../core/monsters/crowd/planar-crowd-candidate-buffer';
import { type PlanarCrowdSeparationSystem } from '../../../core/monsters/crowd/planar-crowd-separation-system';
import { BATTLEFIELD_MONSTER_SPAWN } from '../model/battlefield-monster-spawn';
import {
  type BattlefieldGrabTargetQuery,
  type MutableBattlefieldManipulationCandidate,
} from './battlefield-monster-contracts';
import { type BattlefieldMonsterManipulationGroup } from './battlefield-monster-manipulation-group';

const MAXIMUM_MANIPULATION_CANDIDATES = 256;

/** 使用共享 Crowd 宽相位选择并路由可抓取怪物。 */
export class BattlefieldMonsterManipulationRegistry {
  private readonly groups: BattlefieldMonsterManipulationGroup[] = [];
  private readonly candidates = new PlanarCrowdCandidateBuffer(MAXIMUM_MANIPULATION_CANDIDATES);
  private readonly candidate: MutableBattlefieldManipulationCandidate = {
    populationId: 0,
    entityId: -1,
    x: 0,
    y: 0,
    z: 0,
    healthRatio: 1,
    bodySize: MonsterBodySize.Small,
    grabResistance: 0,
    playerGrabbable: false,
    tags: CombatTag.None,
    throwMass: 0,
    maximumThrowDistance: 0,
    collisionRadius: 0,
    impactStrength: 0,
  };

  constructor(private readonly crowd: PlanarCrowdSeparationSystem) {}

  public register(group: BattlefieldMonsterManipulationGroup): void {
    if (this.groups.some((entry) => entry.populationId === group.populationId)) {
      throw new Error('怪物操作群体标识不能重复登记。');
    }
    this.groups.push(group);
  }

  public unregister(group: BattlefieldMonsterManipulationGroup): void {
    const index = this.groups.indexOf(group);
    if (index >= 0) {
      this.groups.splice(index, 1);
    }
  }

  /** 在方向锥内按距离优先、夹角次优选择唯一合法抓取目标。 */
  public findGrabbable(
    query: Readonly<BattlefieldGrabTargetQuery>,
    result: MutableBattlefieldManipulationCandidate,
  ): boolean {
    validateQuery(query);
    const inverseScale = 1 / BATTLEFIELD_MONSTER_SPAWN.modelScale;
    const endX = query.originX + query.directionX * query.maximumDistance;
    const endZ = query.originZ + query.directionZ * query.maximumDistance;
    this.crowd.collectSegmentCandidates(
      query.originX * inverseScale,
      -query.originZ * inverseScale,
      endX * inverseScale,
      -endZ * inverseScale,
      query.maximumLateralDistance * inverseScale,
      this.candidates,
    );
    let found = false;
    let bestDistanceSquared = Number.POSITIVE_INFINITY;
    let bestAlignment = -1;
    for (let index = 0; index < this.candidates.count; index++) {
      const group = this.findGroup(this.candidates.populationIds[index] ?? 0);
      if (group === null || !group.writeManipulationCandidateForEntity(
        this.candidates.entityIndices[index] ?? 0,
        this.candidate,
      ) || !isGrabbableCandidate(this.candidate)) {
        continue;
      }
      const deltaX = this.candidate.x - query.originX;
      const deltaZ = this.candidate.z - query.originZ;
      const distanceSquared = deltaX * deltaX + deltaZ * deltaZ;
      if (distanceSquared > query.maximumDistance * query.maximumDistance) {
        continue;
      }
      const distance = Math.sqrt(distanceSquared);
      const alignment = distance > 0.000001
        ? (deltaX * query.directionX + deltaZ * query.directionZ) / distance
        : 1;
      if (alignment < query.minimumDirectionAlignment
        || (distanceSquared > bestDistanceSquared + 0.000001)
        || (Math.abs(distanceSquared - bestDistanceSquared) <= 0.000001
          && alignment <= bestAlignment)) {
        continue;
      }
      copyCandidate(this.candidate, result);
      bestDistanceSquared = distanceSquared;
      bestAlignment = alignment;
      found = true;
    }
    return found;
  }

  public beginCarry(populationId: number, entityId: number): boolean {
    const group = this.findGroup(populationId);
    if (group === null || !group.beginCarry(entityId)) {
      return false;
    }
    group.crowdPopulation.inverseMass[entityId] = 0;
    return true;
  }

  public beginThrow(populationId: number, entityId: number): boolean {
    return this.findGroup(populationId)?.beginThrow(entityId) ?? false;
  }

  public synchronizePose(
    populationId: number,
    entityId: number,
    x: number,
    y: number,
    z: number,
    heading: number,
  ): boolean {
    return this.findGroup(populationId)?.synchronizeManipulatedPose(
      entityId,
      x,
      y,
      z,
      heading,
    ) ?? false;
  }

  public release(populationId: number, entityId: number): boolean {
    const group = this.findGroup(populationId);
    if (group === null || !group.releaseManipulation(entityId)) {
      return false;
    }
    group.crowdPopulation.inverseMass[entityId] = 1;
    return true;
  }

  public kill(populationId: number, entityId: number): boolean {
    const group = this.findGroup(populationId);
    if (group === null || !group.killManipulated(entityId)) {
      return false;
    }
    group.crowdPopulation.inverseMass[entityId] = 1;
    return true;
  }

  private findGroup(populationId: number): BattlefieldMonsterManipulationGroup | null {
    for (const group of this.groups) {
      if (group.populationId === populationId) {
        return group;
      }
    }
    return null;
  }
}

function isGrabbableCandidate(candidate: Readonly<MutableBattlefieldManipulationCandidate>): boolean {
  return candidate.playerGrabbable
    && candidate.bodySize === MonsterBodySize.Small
    && candidate.grabResistance <= 0
    && (candidate.tags & CombatTag.SmallBody) !== 0
    && (candidate.tags & CombatTag.Elite) === 0
    && (candidate.tags & CombatTag.Executable) !== 0;
}

function validateQuery(query: Readonly<BattlefieldGrabTargetQuery>): void {
  if (!Number.isFinite(query.originX)
    || !Number.isFinite(query.originZ)
    || !Number.isFinite(query.directionX)
    || !Number.isFinite(query.directionZ)
    || !Number.isFinite(query.maximumDistance)
    || !Number.isFinite(query.maximumLateralDistance)
    || !Number.isFinite(query.minimumDirectionAlignment)
    || Math.abs(Math.hypot(query.directionX, query.directionZ) - 1) > 0.001
    || query.maximumDistance <= 0
    || query.maximumLateralDistance < 0
    || query.minimumDirectionAlignment < -1
    || query.minimumDirectionAlignment > 1) {
    throw new Error('抓取目标查询必须使用单位方向和有效有限范围。');
  }
}

function copyCandidate(
  source: Readonly<MutableBattlefieldManipulationCandidate>,
  target: MutableBattlefieldManipulationCandidate,
): void {
  target.populationId = source.populationId;
  target.entityId = source.entityId;
  target.x = source.x;
  target.y = source.y;
  target.z = source.z;
  target.healthRatio = source.healthRatio;
  target.bodySize = source.bodySize;
  target.grabResistance = source.grabResistance;
  target.playerGrabbable = source.playerGrabbable;
  target.tags = source.tags;
  target.throwMass = source.throwMass;
  target.maximumThrowDistance = source.maximumThrowDistance;
  target.collisionRadius = source.collisionRadius;
  target.impactStrength = source.impactStrength;
}
