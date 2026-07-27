import { MonsterLifecycleState } from '../../../../core/contracts/monster-lifecycle';
import { type PlanarKnockbackEffect, type VerticalLaunchEffect } from '../../../../core/contracts/monster-effects';
import { BATTLEFIELD_MONSTER_SPAWN } from '../../model/battlefield-monster-spawn';
import { type BattlefieldMonsterTargetGroup } from '../../population/battlefield-monster-target-group';

const EFFECT_EPSILON = 0.0001;
const MAGNETIZED_COLLISION_DAMAGE = 9;
const MAGNETIZED_COLLISION_KNOCKBACK_SPEED = 6.5;
const MAGNETIZED_COLLISION_KNOCKBACK_SECONDS = 0.2;

/** 一个怪物群体的连续通用 Effect 数据。 */
class BattlefieldMonsterEffectGroupState {
  public readonly lastHitSequence: Uint32Array;
  public readonly knockbackDirectionX: Float32Array;
  public readonly knockbackDirectionZ: Float32Array;
  public readonly knockbackSpeed: Float32Array;
  public readonly knockbackRemaining: Float32Array;
  public readonly knockbackDuration: Float32Array;
  public readonly elevation: Float32Array;
  public readonly verticalVelocity: Float32Array;
  public readonly gravityScale: Float32Array;
  public readonly airborneActive: Uint8Array;
  public readonly magnetizedRemaining: Float32Array;
  public readonly magnetizedSequence: Uint32Array;

  constructor(public readonly group: BattlefieldMonsterTargetGroup) {
    const count = group.crowdPopulation.count;
    this.lastHitSequence = new Uint32Array(count);
    this.knockbackDirectionX = new Float32Array(count);
    this.knockbackDirectionZ = new Float32Array(count);
    this.knockbackSpeed = new Float32Array(count);
    this.knockbackRemaining = new Float32Array(count);
    this.knockbackDuration = new Float32Array(count);
    this.elevation = new Float32Array(count);
    this.verticalVelocity = new Float32Array(count);
    this.gravityScale = new Float32Array(count);
    this.airborneActive = new Uint8Array(count);
    this.magnetizedRemaining = new Float32Array(count);
    this.magnetizedSequence = new Uint32Array(count);
    this.gravityScale.fill(1);
  }
}

/**
 * 聚合异构怪物群的击退、腾空与磁化碰撞 Effect。
 *
 * 运行时只持有 SoA 数据和稳定群体门面，不 import 任何具体怪物实现。
 */
export class BattlefieldMonsterEffectRuntime {
  private readonly states: BattlefieldMonsterEffectGroupState[] = [];
  private readonly resolvedMagnetizedPairs = new Set<number>();
  private activeMagnetizedSequence = 0;

  constructor(private readonly gravity: number) {
    if (!Number.isFinite(gravity) || gravity <= 0) {
      throw new Error('怪物腾空重力必须为有限正数。');
    }
  }

  public register(group: BattlefieldMonsterTargetGroup): void {
    if (this.states.some((state) => state.group.populationId === group.populationId)) {
      throw new Error('怪物 Effect 群体标识不能重复登记。');
    }
    this.states.push(new BattlefieldMonsterEffectGroupState(group));
  }

  public unregister(group: BattlefieldMonsterTargetGroup): void {
    const index = this.states.findIndex((state) => state.group === group);
    if (index >= 0) {
      this.states.splice(index, 1);
    }
  }

  /** 同一次攻击序列只允许同一实体结算一次。 */
  public acceptHitSequence(
    populationId: number,
    entityId: number,
    attackSequenceId: number,
  ): boolean {
    if (!Number.isSafeInteger(attackSequenceId) || attackSequenceId <= 0) {
      throw new Error('近战攻击序列必须为正安全整数。');
    }
    const state = this.findState(populationId);
    if (state === null || !isValidEntity(state, entityId)
      || (state.lastHitSequence[entityId] ?? 0) === attackSequenceId) {
      return false;
    }
    state.lastHitSequence[entityId] = attackSequenceId;
    return true;
  }

  public applyKnockback(
    populationId: number,
    entityId: number,
    effect: Readonly<PlanarKnockbackEffect>,
  ): boolean {
    validateKnockback(effect);
    const state = this.findState(populationId);
    if (state === null || !isValidEntity(state, entityId)) {
      return false;
    }
    const resistance = Math.max(0, Math.min(1, effect.resistanceScale));
    state.knockbackDirectionX[entityId] = effect.directionX;
    state.knockbackDirectionZ[entityId] = effect.directionZ;
    state.knockbackSpeed[entityId] = effect.initialSpeed * resistance;
    state.knockbackRemaining[entityId] = effect.remainingSeconds;
    state.knockbackDuration[entityId] = effect.remainingSeconds;
    return true;
  }

  public applyVerticalLaunch(
    populationId: number,
    entityId: number,
    effect: Readonly<VerticalLaunchEffect>,
  ): boolean {
    validateVerticalLaunch(effect);
    const state = this.findState(populationId);
    if (state === null || !isValidEntity(state, entityId)) {
      return false;
    }
    const verticalVelocity = effect.initialVelocity
      * Math.max(0, Math.min(1, effect.resistanceScale));
    state.verticalVelocity[entityId] = verticalVelocity;
    state.gravityScale[entityId] = effect.gravityScale;
    state.airborneActive[entityId] = verticalVelocity > 0 ? 1 : 0;
    return true;
  }

  /** 磁化效果按一次旋转技能的稳定序列隔离碰撞去重。 */
  public applyMagnetized(
    populationId: number,
    entityId: number,
    skillSequenceId: number,
    durationSeconds: number,
  ): boolean {
    if (!Number.isSafeInteger(skillSequenceId) || skillSequenceId <= 0
      || !Number.isFinite(durationSeconds) || durationSeconds <= 0) {
      throw new Error('磁化序列和持续时间参数无效。');
    }
    const state = this.findState(populationId);
    if (state === null || !isValidEntity(state, entityId)) {
      return false;
    }
    if (this.activeMagnetizedSequence !== skillSequenceId) {
      this.activeMagnetizedSequence = skillSequenceId;
      this.resolvedMagnetizedPairs.clear();
    }
    state.magnetizedSequence[entityId] = skillSequenceId;
    state.magnetizedRemaining[entityId] = durationSeconds;
    return true;
  }

  /** 在怪物自主移动之后推进 Effect，再由 Crowd 统一约束最终位置。 */
  public update(deltaTime: number): void {
    if (!Number.isFinite(deltaTime) || deltaTime < 0) {
      throw new Error('怪物 Effect 帧时间必须为有限非负数。');
    }
    const safeDeltaTime = Math.min(deltaTime, 0.05);
    for (const state of this.states) {
      this.updateState(state, safeDeltaTime);
    }
    this.resolveMagnetizedCollisions();
  }

  private updateState(state: BattlefieldMonsterEffectGroupState, deltaTime: number): void {
    const crowd = state.group.crowdPopulation;
    const inverseScale = 1 / BATTLEFIELD_MONSTER_SPAWN.modelScale;
    for (let entityId = 0; entityId < crowd.count; entityId++) {
      if ((crowd.lifecycle[entityId] as MonsterLifecycleState) !== MonsterLifecycleState.Alive) {
        resetEntityEffect(state, entityId);
        state.group.setAirborneEffect(entityId, false, 0);
        continue;
      }
      const remaining = state.knockbackRemaining[entityId] ?? 0;
      if (remaining > 0) {
        const duration = Math.max(state.knockbackDuration[entityId] ?? remaining, EFFECT_EPSILON);
        const speed = (state.knockbackSpeed[entityId] ?? 0) * remaining / duration;
        crowd.x[entityId] = (crowd.x[entityId] ?? 0)
          + (state.knockbackDirectionX[entityId] ?? 0) * speed * deltaTime * inverseScale;
        crowd.y[entityId] = (crowd.y[entityId] ?? 0)
          - (state.knockbackDirectionZ[entityId] ?? 0) * speed * deltaTime * inverseScale;
        state.knockbackRemaining[entityId] = Math.max(0, remaining - deltaTime);
      }

      let elevation = state.elevation[entityId] ?? 0;
      let velocity = state.verticalVelocity[entityId] ?? 0;
      let airborne = (state.airborneActive[entityId] ?? 0) !== 0;
      if (airborne) {
        velocity -= this.gravity * (state.gravityScale[entityId] ?? 1) * deltaTime;
        elevation += velocity * deltaTime;
        if (elevation <= 0 && velocity <= 0) {
          elevation = 0;
          velocity = 0;
          airborne = false;
        }
        state.elevation[entityId] = elevation;
        state.verticalVelocity[entityId] = velocity;
        state.airborneActive[entityId] = airborne ? 1 : 0;
      }
      state.group.setAirborneEffect(entityId, airborne, elevation);
      state.magnetizedRemaining[entityId] = Math.max(
        0,
        (state.magnetizedRemaining[entityId] ?? 0) - deltaTime,
      );
    }
  }

  private resolveMagnetizedCollisions(): void {
    for (let firstStateIndex = 0; firstStateIndex < this.states.length; firstStateIndex++) {
      const firstState = this.states[firstStateIndex];
      if (firstState === undefined) {
        continue;
      }
      for (let firstEntity = 0; firstEntity < firstState.group.crowdPopulation.count; firstEntity++) {
        if ((firstState.magnetizedRemaining[firstEntity] ?? 0) <= 0) {
          continue;
        }
        for (let secondStateIndex = firstStateIndex; secondStateIndex < this.states.length;
          secondStateIndex++) {
          const secondState = this.states[secondStateIndex];
          if (secondState === undefined) {
            continue;
          }
          const secondStart = secondStateIndex === firstStateIndex ? firstEntity + 1 : 0;
          for (let secondEntity = secondStart;
            secondEntity < secondState.group.crowdPopulation.count; secondEntity++) {
            if ((secondState.magnetizedRemaining[secondEntity] ?? 0) <= 0
              || (firstState.magnetizedSequence[firstEntity] ?? 0)
                !== (secondState.magnetizedSequence[secondEntity] ?? 0)) {
              continue;
            }
            this.resolveMagnetizedPair(firstState, firstEntity, secondState, secondEntity);
          }
        }
      }
    }
  }

  private resolveMagnetizedPair(
    firstState: BattlefieldMonsterEffectGroupState,
    firstEntity: number,
    secondState: BattlefieldMonsterEffectGroupState,
    secondEntity: number,
  ): void {
    const firstCrowd = firstState.group.crowdPopulation;
    const secondCrowd = secondState.group.crowdPopulation;
    const deltaLocalX = (secondCrowd.x[secondEntity] ?? 0) - (firstCrowd.x[firstEntity] ?? 0);
    const deltaLocalY = (secondCrowd.y[secondEntity] ?? 0) - (firstCrowd.y[firstEntity] ?? 0);
    const contactRadius = (firstCrowd.radius[firstEntity] ?? 0)
      + (secondCrowd.radius[secondEntity] ?? 0);
    const distanceSquared = deltaLocalX * deltaLocalX + deltaLocalY * deltaLocalY;
    if (distanceSquared > contactRadius * contactRadius) {
      return;
    }
    const pairKey = createPairKey(
      firstState.group.populationId,
      firstEntity,
      secondState.group.populationId,
      secondEntity,
    );
    if (this.resolvedMagnetizedPairs.has(pairKey)) {
      return;
    }
    this.resolvedMagnetizedPairs.add(pairKey);
    const length = Math.max(Math.sqrt(distanceSquared), EFFECT_EPSILON);
    const directionX = deltaLocalX / length;
    const directionZ = -deltaLocalY / length;
    firstState.group.damageMonster(firstEntity, MAGNETIZED_COLLISION_DAMAGE);
    secondState.group.damageMonster(secondEntity, MAGNETIZED_COLLISION_DAMAGE);
    this.writeCollisionKnockback(firstState, firstEntity, -directionX, -directionZ);
    this.writeCollisionKnockback(secondState, secondEntity, directionX, directionZ);
  }

  private writeCollisionKnockback(
    state: BattlefieldMonsterEffectGroupState,
    entityId: number,
    directionX: number,
    directionZ: number,
  ): void {
    state.knockbackDirectionX[entityId] = directionX;
    state.knockbackDirectionZ[entityId] = directionZ;
    state.knockbackSpeed[entityId] = MAGNETIZED_COLLISION_KNOCKBACK_SPEED;
    state.knockbackRemaining[entityId] = MAGNETIZED_COLLISION_KNOCKBACK_SECONDS;
    state.knockbackDuration[entityId] = MAGNETIZED_COLLISION_KNOCKBACK_SECONDS;
  }

  private findState(populationId: number): BattlefieldMonsterEffectGroupState | null {
    for (const state of this.states) {
      if (state.group.populationId === populationId) {
        return state;
      }
    }
    return null;
  }
}

function isValidEntity(state: BattlefieldMonsterEffectGroupState, entityId: number): boolean {
  return Number.isSafeInteger(entityId)
    && entityId >= 0
    && entityId < state.group.crowdPopulation.count;
}

function validateKnockback(effect: Readonly<PlanarKnockbackEffect>): void {
  if (![effect.directionX, effect.directionZ, effect.initialSpeed,
    effect.remainingSeconds, effect.resistanceScale].every(Number.isFinite)
    || Math.abs(Math.hypot(effect.directionX, effect.directionZ) - 1) > 0.001
    || effect.initialSpeed < 0
    || effect.remainingSeconds <= 0
    || effect.resistanceScale < 0) {
    throw new Error('平面击退 Effect 参数无效。');
  }
}

function validateVerticalLaunch(effect: Readonly<VerticalLaunchEffect>): void {
  if (![effect.initialVelocity, effect.gravityScale, effect.resistanceScale].every(Number.isFinite)
    || effect.initialVelocity < 0
    || effect.gravityScale <= 0
    || effect.resistanceScale < 0) {
    throw new Error('垂直腾空 Effect 参数无效。');
  }
}

function resetEntityEffect(state: BattlefieldMonsterEffectGroupState, entityId: number): void {
  state.knockbackRemaining[entityId] = 0;
  state.elevation[entityId] = 0;
  state.verticalVelocity[entityId] = 0;
  state.airborneActive[entityId] = 0;
  state.magnetizedRemaining[entityId] = 0;
  state.magnetizedSequence[entityId] = 0;
}

function createPairKey(
  firstPopulationId: number,
  firstEntityId: number,
  secondPopulationId: number,
  secondEntityId: number,
): number {
  const first = firstPopulationId * 1024 + firstEntityId;
  const second = secondPopulationId * 1024 + secondEntityId;
  const minimum = Math.min(first, second);
  const maximum = Math.max(first, second);
  return minimum * 65536 + maximum;
}
