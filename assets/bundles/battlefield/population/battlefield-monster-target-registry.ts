import { PlanarCrowdCandidateBuffer } from '../../../core/monsters/crowd/planar-crowd-candidate-buffer';
import { type PlanarCrowdSeparationSystem } from '../../../core/monsters/crowd/planar-crowd-separation-system';
import { BATTLEFIELD_MONSTER_SPAWN } from '../model/battlefield-monster-spawn';
import {
  type BattlefieldMeleeHitBuffer,
  type BattlefieldMeleeQuery,
} from '../combat/melee/battlefield-melee-query';
import { type BattlefieldMonsterTargetGroup } from './battlefield-monster-target-group';

const MAXIMUM_CROWD_CANDIDATES = 512;
const DIRECTION_EPSILON = 0.000001;

/** 聚合异构怪物群的近战空间查询与稳定实体伤害路由。 */
export class BattlefieldMonsterTargetRegistry {
  private readonly groups: BattlefieldMonsterTargetGroup[] = [];
  private readonly candidates = new PlanarCrowdCandidateBuffer(MAXIMUM_CROWD_CANDIDATES);

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

  /** 用共享 Crowd 宽相位收集扇形或整圆范围内的全部近战目标。 */
  public collectMeleeHits(
    query: Readonly<BattlefieldMeleeQuery>,
    result: BattlefieldMeleeHitBuffer,
  ): number {
    validateMeleeQuery(query);
    result.reset();
    const scale = BATTLEFIELD_MONSTER_SPAWN.modelScale;
    const inverseScale = 1 / scale;
    this.crowd.collectCircleCandidates(
      query.originX * inverseScale,
      -query.originZ * inverseScale,
      query.reach * inverseScale,
      this.candidates,
    );
    const fullCircle = query.arcRadians >= Math.PI * 2 - 0.001;
    const minimumAlignment = Math.cos(query.arcRadians * 0.5);
    for (let index = 0; index < this.candidates.count; index++) {
      const populationId = this.candidates.populationIds[index] ?? 0;
      const entityId = this.candidates.entityIndices[index] ?? 0;
      const group = this.findGroup(populationId);
      const crowd = group?.crowdPopulation;
      if (crowd === undefined) {
        continue;
      }
      const x = (crowd.x[entityId] ?? 0) * scale;
      const z = -(crowd.y[entityId] ?? 0) * scale;
      const deltaX = x - query.originX;
      const deltaZ = z - query.originZ;
      const distance = Math.hypot(deltaX, deltaZ);
      const reach = query.reach + (crowd.radius[entityId] ?? 0) * scale;
      if (distance > reach) {
        continue;
      }
      if (!fullCircle && distance > DIRECTION_EPSILON
        && (deltaX * query.directionX + deltaZ * query.directionZ) / distance
          < minimumAlignment) {
        continue;
      }
      result.include(populationId, entityId, x, z);
    }
    return result.count;
  }

  public getKnockbackResistance(populationId: number): number {
    return this.findGroup(populationId)?.knockbackResistanceScale ?? 0;
  }

  public getAirborneResistance(populationId: number): number {
    return this.findGroup(populationId)?.airborneResistanceScale ?? 0;
  }

  /** 按稳定群体标识路由伤害。 */
  public damageMonster(populationId: number, entityId: number, amount: number): boolean {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('近战伤害必须为有限正数。');
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

function validateMeleeQuery(query: Readonly<BattlefieldMeleeQuery>): void {
  if (![query.originX, query.originZ, query.directionX, query.directionZ,
    query.reach, query.arcRadians].every(Number.isFinite)
    || query.reach <= 0
    || query.arcRadians <= 0
    || query.arcRadians > Math.PI * 2
    || Math.abs(Math.hypot(query.directionX, query.directionZ) - 1) > 0.001) {
    throw new Error('近战查询必须使用单位方向、有限正射程和合法弧度。');
  }
}
