import { PlanarCrowdCandidateBuffer } from '../../../core/monsters/crowd/planar-crowd-candidate-buffer';
import { type PlanarCrowdSeparationSystem } from '../../../core/monsters/crowd/planar-crowd-separation-system';
import { BATTLEFIELD_MONSTER_SPAWN } from '../model/battlefield-monster-spawn';
import {
  type BattlefieldMeleeAttackDirectionQuery,
  type MutableBattlefieldMeleeAttackDirection,
} from '../combat/battlefield-melee-attack-direction';
import {
  type BattlefieldMeleeHitBuffer,
  type BattlefieldMeleeQuery,
  type BattlefieldMeleeSweepQuery,
} from '../combat/melee/battlefield-melee-query';
import { type BattlefieldMonsterTargetGroup } from './battlefield-monster-target-group';
import { BattlefieldMeleeAttackDirectionPlanner } from './battlefield-melee-attack-direction-planner';
import {
  isMonsterLifecycleResident,
  MonsterLifecycleState,
} from '../../../core/contracts/monster-lifecycle';
import {
  type BattlefieldArrowAimQuery,
  type BattlefieldArrowHitBuffer,
  type BattlefieldArrowSweepQuery,
  type BattlefieldTetherQuery,
  type MutableBattlefieldArrowAimTarget,
  type MutableBattlefieldArrowTargetPose,
} from '../equipment/projectile/model/battlefield-arrow-query';
import {
  findArrowVerticalCapsuleContactProgress,
} from '../equipment/projectile/population/battlefield-arrow-capsule-intersection';
import {
  findTetherVerticalRangeOverlapProgress,
} from '../equipment/projectile/population/battlefield-tether-range-overlap';
import {
  BattlefieldTetherOverlapDebugAggregate,
} from './battlefield-tether-overlap-debug-aggregate';

const MAXIMUM_CROWD_CANDIDATES = 512;
const DIRECTION_EPSILON = 0.000001;

/** 聚合异构怪物群的近战空间查询与稳定实体伤害路由。 */
export class BattlefieldMonsterTargetRegistry {
  private readonly groups: BattlefieldMonsterTargetGroup[] = [];
  private readonly candidates = new PlanarCrowdCandidateBuffer(MAXIMUM_CROWD_CANDIDATES);
  private readonly tetherOverlapDebug = new BattlefieldTetherOverlapDebugAggregate();
  private readonly attackDirectionPlanner = new BattlefieldMeleeAttackDirectionPlanner(
    MAXIMUM_CROWD_CANDIDATES,
  );

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

  /** 在共享圆形宽相位上规划一次带目标迟滞的最佳大锤挥击方向。 */
  public writeBestMeleeAttackDirection(
    query: Readonly<BattlefieldMeleeAttackDirectionQuery>,
    result: MutableBattlefieldMeleeAttackDirection,
  ): boolean {
    const scale = BATTLEFIELD_MONSTER_SPAWN.modelScale;
    const inverseScale = 1 / scale;
    this.crowd.collectCircleCandidates(
      query.originX * inverseScale,
      -query.originZ * inverseScale,
      query.releaseRadius * inverseScale,
      this.candidates,
    );
    return this.attackDirectionPlanner.write(
      query,
      this.groups,
      this.candidates,
      scale,
      result,
    );
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

  /** 用共享 Crowd DDA 宽相位和线段距离窄相位收集锤头连续扫掠目标。 */
  public collectMeleeSweepHits(
    query: Readonly<BattlefieldMeleeSweepQuery>,
    result: BattlefieldMeleeHitBuffer,
  ): number {
    validateMeleeSweepQuery(query);
    result.reset();
    const scale = BATTLEFIELD_MONSTER_SPAWN.modelScale;
    const inverseScale = 1 / scale;
    const startX = query.startX * inverseScale;
    const startY = -query.startZ * inverseScale;
    const endX = query.endX * inverseScale;
    const endY = -query.endZ * inverseScale;
    const radius = query.radius * inverseScale;
    this.crowd.collectSegmentCandidates(
      startX,
      startY,
      endX,
      endY,
      radius,
      this.candidates,
    );
    for (let index = 0; index < this.candidates.count; index++) {
      const populationId = this.candidates.populationIds[index] ?? 0;
      const entityId = this.candidates.entityIndices[index] ?? 0;
      const group = this.findGroup(populationId);
      const crowd = group?.crowdPopulation;
      if (crowd === undefined) {
        continue;
      }
      const targetX = crowd.x[entityId] ?? 0;
      const targetY = crowd.y[entityId] ?? 0;
      const contactRadius = radius + (crowd.radius[entityId] ?? 0);
      if (distanceSquaredToSegment(targetX, targetY, startX, startY, endX, endY)
        > contactRadius * contactRadius) {
        continue;
      }
      result.include(populationId, entityId, targetX * scale, -targetY * scale);
    }
    return result.count;
  }

  /** 复用 Crowd 线段宽相位收集箭头连续扫掠目标。 */
  public collectArrowSweepHits(
    query: Readonly<BattlefieldArrowSweepQuery>,
    result: BattlefieldArrowHitBuffer,
  ): number {
    if (![query.startX, query.startY, query.startZ, query.endX, query.endY,
      query.endZ, query.radius].every(Number.isFinite) || query.radius <= 0) {
      throw new Error('箭矢连续扫掠查询参数无效。');
    }
    result.reset();
    const scale = BATTLEFIELD_MONSTER_SPAWN.modelScale;
    const inverseScale = 1 / scale;
    const startX = query.startX * inverseScale;
    const startY = -query.startZ * inverseScale;
    const endX = query.endX * inverseScale;
    const endY = -query.endZ * inverseScale;
    const radius = query.radius * inverseScale;
    this.crowd.collectSegmentCandidates(startX, startY, endX, endY, radius, this.candidates);
    for (let index = 0; index < this.candidates.count; index++) {
      const populationId = this.candidates.populationIds[index] ?? 0;
      const entityId = this.candidates.entityIndices[index] ?? 0;
      const crowd = this.findGroup(populationId)?.crowdPopulation;
      if (crowd === undefined
        || (crowd.lifecycle[entityId] as MonsterLifecycleState) !== MonsterLifecycleState.Alive
        || (crowd.participation[entityId] ?? 0) === 0) {
        continue;
      }
      const targetX = (crowd.x[entityId] ?? 0) * scale;
      const targetZ = -(crowd.y[entityId] ?? 0) * scale;
      const centerY = BATTLEFIELD_MONSTER_SPAWN.groundOffsetY
        + ((crowd.centerHeight[entityId] ?? 0) + (crowd.elevation[entityId] ?? 0)) * scale;
      const contactRadius = query.radius + (crowd.radius[entityId] ?? 0) * scale;
      const progress = findArrowVerticalCapsuleContactProgress(
        query.startX, query.startY, query.startZ,
        query.endX, query.endY, query.endZ,
        targetX, centerY, targetZ,
        (crowd.halfHeight[entityId] ?? 0) * scale,
        contactRadius,
      );
      if (progress < 0) {
        continue;
      }
      result.include(
        populationId,
        entityId,
        query.startX + (query.endX - query.startX) * progress,
        query.startY + (query.endY - query.startY) * progress,
        query.startZ + (query.endZ - query.startZ) * progress,
        progress,
      );
    }
    return result.count;
  }

  /**
   * 使用一次平面投影和竖直范围判断收集弦线重叠目标。
   *
   * 弦线只关心当前重叠，不计算首次接触时间，也不进入箭矢胶囊二分求交。
   */
  public collectTetherOverlapHits(
    query: Readonly<BattlefieldTetherQuery>,
    result: BattlefieldArrowHitBuffer,
  ): number {
    if (![query.startX, query.startY, query.startZ, query.endX, query.endY,
      query.endZ, query.radius].every(Number.isFinite) || query.radius <= 0) {
      throw new Error('弦线重叠查询参数无效。');
    }
    result.reset();
    const scale = BATTLEFIELD_MONSTER_SPAWN.modelScale;
    const inverseScale = 1 / scale;
    const startX = query.startX * inverseScale;
    const startY = -query.startZ * inverseScale;
    const endX = query.endX * inverseScale;
    const endY = -query.endZ * inverseScale;
    const radius = query.radius * inverseScale;
    this.crowd.collectSegmentCandidates(startX, startY, endX, endY, radius, this.candidates);
    this.tetherOverlapDebug.beginQuery(this.candidates.count);
    for (let index = 0; index < this.candidates.count; index++) {
      const populationId = this.candidates.populationIds[index] ?? 0;
      const entityId = this.candidates.entityIndices[index] ?? 0;
      const crowd = this.findGroup(populationId)?.crowdPopulation;
      if (crowd === undefined
        || (crowd.lifecycle[entityId] as MonsterLifecycleState) !== MonsterLifecycleState.Alive
        || (crowd.participation[entityId] ?? 0) === 0) {
        this.tetherOverlapDebug.rejectLifecycle();
        continue;
      }
      const targetX = (crowd.x[entityId] ?? 0) * scale;
      const targetZ = -(crowd.y[entityId] ?? 0) * scale;
      const centerY = BATTLEFIELD_MONSTER_SPAWN.groundOffsetY
        + ((crowd.centerHeight[entityId] ?? 0) + (crowd.elevation[entityId] ?? 0)) * scale;
      const footY = BATTLEFIELD_MONSTER_SPAWN.groundOffsetY
        + (crowd.elevation[entityId] ?? 0) * scale;
      const bodyTopY = centerY + (crowd.halfHeight[entityId] ?? 0) * scale;
      const minimumY = footY - query.radius;
      const maximumY = bodyTopY + query.radius;
      const contactRadius = query.radius + (crowd.radius[entityId] ?? 0) * scale;
      const progress = findTetherVerticalRangeOverlapProgress(
        query.startX, query.startY, query.startZ,
        query.endX, query.endY, query.endZ,
        targetX, targetZ,
        minimumY, maximumY,
        contactRadius,
      );
      this.tetherOverlapDebug.observeCandidate(
        populationId,
        entityId,
        query,
        targetX,
        targetZ,
        minimumY,
        maximumY,
        contactRadius,
        progress,
      );
      if (progress < 0) {
        continue;
      }
      const nearestX = query.startX + (query.endX - query.startX) * progress;
      const lineY = query.startY + (query.endY - query.startY) * progress;
      const nearestZ = query.startZ + (query.endZ - query.startZ) * progress;
      result.include(populationId, entityId, nearestX, lineY, nearestZ, progress);
    }
    this.tetherOverlapDebug.flushIfDue();
    return result.count;
  }

  /** 沿给定平面方向选择最近的胶囊体，并只返回垂直辅助瞄准点。 */
  public writeBestArrowAimTarget(
    query: Readonly<BattlefieldArrowAimQuery>,
    result: MutableBattlefieldArrowAimTarget,
  ): boolean {
    const scale = BATTLEFIELD_MONSTER_SPAWN.modelScale;
    const inverseScale = 1 / scale;
    const endX = query.originX + query.directionX * query.maximumDistance;
    const endZ = query.originZ + query.directionZ * query.maximumDistance;
    this.crowd.collectSegmentCandidates(
      query.originX * inverseScale,
      -query.originZ * inverseScale,
      endX * inverseScale,
      -endZ * inverseScale,
      query.projectileRadius * inverseScale,
      this.candidates,
    );
    let bestProgress = Number.POSITIVE_INFINITY;
    let found = false;
    for (let index = 0; index < this.candidates.count; index++) {
      const populationId = this.candidates.populationIds[index] ?? 0;
      const entityId = this.candidates.entityIndices[index] ?? 0;
      const crowd = this.findGroup(populationId)?.crowdPopulation;
      if (crowd === undefined
        || (crowd.lifecycle[entityId] as MonsterLifecycleState) !== MonsterLifecycleState.Alive
        || (crowd.participation[entityId] ?? 0) === 0) {
        continue;
      }
      const x = (crowd.x[entityId] ?? 0) * scale;
      const z = -(crowd.y[entityId] ?? 0) * scale;
      const progress = ((x - query.originX) * query.directionX
        + (z - query.originZ) * query.directionZ) / query.maximumDistance;
      if (progress < 0 || progress > 1 || progress >= bestProgress) {
        continue;
      }
      const rayX = query.originX + query.directionX * query.maximumDistance * progress;
      const rayZ = query.originZ + query.directionZ * query.maximumDistance * progress;
      const contactRadius = query.projectileRadius + (crowd.radius[entityId] ?? 0) * scale;
      if ((x - rayX) ** 2 + (z - rayZ) ** 2 > contactRadius * contactRadius) {
        continue;
      }
      bestProgress = progress;
      result.x = x;
      result.y = BATTLEFIELD_MONSTER_SPAWN.groundOffsetY
        + ((crowd.centerHeight[entityId] ?? 0) + (crowd.elevation[entityId] ?? 0)) * scale;
      result.z = z;
      found = true;
    }
    return found;
  }

  /** 为附着箭写入怪物当前三维胶囊姿态。 */
  public writeArrowTargetPose(
    populationId: number,
    entityId: number,
    result: MutableBattlefieldArrowTargetPose,
  ): boolean {
    const crowd = this.findGroup(populationId)?.crowdPopulation;
    if (crowd === undefined || entityId < 0 || entityId >= crowd.count
      || !isMonsterLifecycleResident(crowd.lifecycle[entityId] as MonsterLifecycleState)) {
      return false;
    }
    const scale = BATTLEFIELD_MONSTER_SPAWN.modelScale;
    result.centerX = (crowd.x[entityId] ?? 0) * scale;
    result.centerY = BATTLEFIELD_MONSTER_SPAWN.groundOffsetY
      + ((crowd.centerHeight[entityId] ?? 0) + (crowd.elevation[entityId] ?? 0)) * scale;
    result.centerZ = -(crowd.y[entityId] ?? 0) * scale;
    result.radius = (crowd.radius[entityId] ?? 0) * scale;
    result.halfHeight = (crowd.halfHeight[entityId] ?? 0) * scale;
    return true;
  }

  public getKnockbackResistance(populationId: number): number {
    return this.findGroup(populationId)?.launchResponse.knockbackScale ?? 0;
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

function validateMeleeSweepQuery(query: Readonly<BattlefieldMeleeSweepQuery>): void {
  if (![query.startX, query.startZ, query.endX, query.endZ, query.radius].every(Number.isFinite)
    || query.radius <= 0) {
    throw new Error('锤头连续扫掠查询必须使用有限端点和正半径。');
  }
}

/** 返回平面点到有限线段的平方距离。 */
export function distanceSquaredToSegment(
  pointX: number,
  pointY: number,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
): number {
  const segmentX = endX - startX;
  const segmentY = endY - startY;
  const lengthSquared = segmentX * segmentX + segmentY * segmentY;
  const progress = lengthSquared <= DIRECTION_EPSILON
    ? 0
    : Math.max(0, Math.min(1,
      ((pointX - startX) * segmentX + (pointY - startY) * segmentY) / lengthSquared));
  const nearestX = startX + segmentX * progress;
  const nearestY = startY + segmentY * progress;
  const deltaX = pointX - nearestX;
  const deltaY = pointY - nearestY;
  return deltaX * deltaX + deltaY * deltaY;
}
