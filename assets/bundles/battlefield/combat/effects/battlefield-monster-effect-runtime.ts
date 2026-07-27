import { MonsterLifecycleState } from '../../../../core/contracts/monster-lifecycle';
import {
  type DirectionalLaunchEffect,
  type PlanarKnockbackEffect,
  PlanarKnockbackCombineMode,
  type VerticalLaunchEffect,
} from '../../../../core/contracts/monster-effects';
import { type PlanarCrowdCollisionSource } from '../../../../core/monsters/crowd/planar-crowd-separation-system';
import { BATTLEFIELD_MONSTER_SPAWN } from '../../model/battlefield-monster-spawn';
import { type BattlefieldMonsterTargetGroup } from '../../population/battlefield-monster-target-group';
import { BattlefieldKineticPropagationSystem } from './battlefield-kinetic-propagation-system';
import {
  BattlefieldMonsterEffectGroupState,
  isValidEffectEntity,
} from './battlefield-monster-effect-state';

const EFFECT_EPSILON = 0.0001;
const MINIMUM_VISIBLE_LAUNCH_HEIGHT = 0.6;

/**
 * 聚合异构怪物群的击退、腾空与动量载体 Effect。
 *
 * 运行时只持有 SoA 数据和稳定群体门面，不 import 任何具体怪物实现。
 */
export class BattlefieldMonsterEffectRuntime {
  private readonly states: BattlefieldMonsterEffectGroupState[] = [];
  private readonly kinetic: BattlefieldKineticPropagationSystem;
  private frameId = 0;

  constructor(
    private readonly gravity: number,
    collisionSource: PlanarCrowdCollisionSource,
  ) {
    if (!Number.isFinite(gravity) || gravity <= 0) {
      throw new Error('怪物腾空重力必须为有限正数。');
    }
    this.kinetic = new BattlefieldKineticPropagationSystem(collisionSource);
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
    if (state === null || !isValidEffectEntity(state, entityId)
      || (state.lastHitSequence[entityId] ?? 0) === attackSequenceId) {
      return false;
    }
    state.lastHitSequence[entityId] = attackSequenceId;
    return true;
  }

  /** 记录单个目标在当前旋风技能中的累计脉冲命中次数。 */
  public recordSpinHit(
    populationId: number,
    entityId: number,
    skillSequenceId: number,
  ): number {
    if (!Number.isSafeInteger(skillSequenceId) || skillSequenceId <= 0) {
      throw new Error('旋风技能序列必须为正安全整数。');
    }
    const state = this.findState(populationId);
    if (state === null || !isValidEffectEntity(state, entityId)) {
      return 0;
    }
    if ((state.spinHitSkillSequence[entityId] ?? 0) !== skillSequenceId) {
      state.spinHitSkillSequence[entityId] = skillSequenceId;
      state.spinHitCount[entityId] = 0;
    }
    const hitCount = Math.min((state.spinHitCount[entityId] ?? 0) + 1, 255);
    state.spinHitCount[entityId] = hitCount;
    return hitCount;
  }

  public applyKnockback(
    populationId: number,
    entityId: number,
    effect: Readonly<PlanarKnockbackEffect>,
  ): boolean {
    validateKnockback(effect);
    const state = this.findState(populationId);
    if (state === null || !isValidEffectEntity(state, entityId)) {
      return false;
    }
    const resistance = Math.max(0, Math.min(1, effect.resistanceScale));
    if (effect.combineMode === PlanarKnockbackCombineMode.Accumulate) {
      return accumulateKnockback(state, entityId, effect, resistance);
    }
    state.knockbackDirectionX[entityId] = effect.directionX;
    state.knockbackDirectionZ[entityId] = effect.directionZ;
    state.knockbackSpeed[entityId] = Math.min(
      effect.initialSpeed * resistance,
      effect.maximumSpeed,
    );
    state.knockbackRemaining[entityId] = effect.remainingSeconds;
    state.knockbackDuration[entityId] = effect.remainingSeconds;
    return true;
  }

  /** 用目标高度计算垂直初速度，并按怪物响应分别缩放水平与高度。 */
  public applyDirectionalLaunch(
    populationId: number,
    entityId: number,
    effect: Readonly<DirectionalLaunchEffect>,
  ): boolean {
    validateDirectionalLaunch(effect);
    const state = this.findState(populationId);
    if (state === null || !isValidEffectEntity(state, entityId)
      || !state.group.launchResponse.launchable) {
      return false;
    }
    const response = state.group.launchResponse;
    state.airborneVelocityX[entityId] = effect.directionX
      * effect.horizontalSpeed * response.horizontalScale;
    state.airborneVelocityZ[entityId] = effect.directionZ
      * effect.horizontalSpeed * response.horizontalScale;
    state.airborneHorizontalDrag[entityId] = effect.horizontalDrag;
    const targetHeight = Math.max(
      effect.targetHeight * response.heightScale,
      MINIMUM_VISIBLE_LAUNCH_HEIGHT,
    );
    const effectiveGravity = this.gravity * effect.gravityScale;
    const verticalVelocity = Math.sqrt(2 * effectiveGravity * targetHeight);
    state.verticalVelocity[entityId] = verticalVelocity;
    state.gravityScale[entityId] = effect.gravityScale;
    state.airborneActive[entityId] = 1;
    return true;
  }

  public applyVerticalLaunch(
    populationId: number,
    entityId: number,
    effect: Readonly<VerticalLaunchEffect>,
  ): boolean {
    validateVerticalLaunch(effect);
    const state = this.findState(populationId);
    if (state === null || !isValidEffectEntity(state, entityId)) {
      return false;
    }
    const verticalVelocity = effect.initialVelocity
      * Math.max(0, Math.min(1, effect.resistanceScale));
    state.verticalVelocity[entityId] = verticalVelocity;
    state.airborneVelocityX[entityId] = 0;
    state.airborneVelocityZ[entityId] = 0;
    state.airborneHorizontalDrag[entityId] = 0;
    state.gravityScale[entityId] = effect.gravityScale;
    state.airborneActive[entityId] = verticalVelocity > 0 ? 1 : 0;
    return true;
  }

  /** 把旋风直接命中的目标登记为当前技能的初代动量载体。 */
  public applyKineticCarrier(
    populationId: number,
    entityId: number,
    skillSequenceId: number,
    baseDamage: number,
    damageBudget: number,
  ): boolean {
    if (!Number.isSafeInteger(skillSequenceId) || skillSequenceId <= 0
      || !Number.isFinite(baseDamage) || baseDamage <= 0
      || !Number.isFinite(damageBudget) || damageBudget < 0) {
      throw new Error('动量载体序列、基础伤害或伤害预算无效。');
    }
    const state = this.findState(populationId);
    if (state === null || !isValidEffectEntity(state, entityId)) {
      return false;
    }
    return this.kinetic.applyDirectCarrier(
      state,
      entityId,
      skillSequenceId,
      baseDamage,
      damageBudget,
      this.frameId,
    );
  }

  /** 在怪物自主移动之后推进 Effect，再由 Crowd 统一约束最终位置。 */
  public update(deltaTime: number): void {
    if (!Number.isFinite(deltaTime) || deltaTime < 0) {
      throw new Error('怪物 Effect 帧时间必须为有限非负数。');
    }
    const safeDeltaTime = Math.min(deltaTime, 0.05);
    this.frameId = this.frameId >= 0xffffffff ? 1 : this.frameId + 1;
    this.kinetic.advanceTime(safeDeltaTime);
    for (const state of this.states) {
      this.updateState(state, safeDeltaTime);
    }
    this.kinetic.resolve(this.states, this.frameId);
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
      if ((state.kineticRemaining[entityId] ?? 0) > 0) {
        state.kineticSweepStartX[entityId] = crowd.x[entityId] ?? 0;
        state.kineticSweepStartY[entityId] = crowd.y[entityId] ?? 0;
      }
      updateKnockback(state, entityId, deltaTime, inverseScale);
      this.updateAirborne(state, entityId, deltaTime, inverseScale);
      state.kineticRemaining[entityId] = Math.max(
        0,
        (state.kineticRemaining[entityId] ?? 0) - deltaTime,
      );
    }
  }

  private updateAirborne(
    state: BattlefieldMonsterEffectGroupState,
    entityId: number,
    deltaTime: number,
    inverseScale: number,
  ): void {
    const crowd = state.group.crowdPopulation;
    let elevation = state.elevation[entityId] ?? 0;
    let velocity = state.verticalVelocity[entityId] ?? 0;
    let airborne = (state.airborneActive[entityId] ?? 0) !== 0;
    if (airborne) {
      crowd.x[entityId] = (crowd.x[entityId] ?? 0)
        + (state.airborneVelocityX[entityId] ?? 0) * deltaTime * inverseScale;
      crowd.y[entityId] = (crowd.y[entityId] ?? 0)
        - (state.airborneVelocityZ[entityId] ?? 0) * deltaTime * inverseScale;
      const damping = Math.exp(-(state.airborneHorizontalDrag[entityId] ?? 0) * deltaTime);
      state.airborneVelocityX[entityId] = (state.airborneVelocityX[entityId] ?? 0) * damping;
      state.airborneVelocityZ[entityId] = (state.airborneVelocityZ[entityId] ?? 0) * damping;
      velocity -= this.gravity * (state.gravityScale[entityId] ?? 1) * deltaTime;
      elevation += velocity * deltaTime;
      if (elevation <= 0 && velocity <= 0) {
        elevation = 0;
        velocity = 0;
        airborne = false;
        state.airborneVelocityX[entityId] = 0;
        state.airborneVelocityZ[entityId] = 0;
        state.airborneHorizontalDrag[entityId] = 0;
      }
      state.elevation[entityId] = elevation;
      state.verticalVelocity[entityId] = velocity;
      state.airborneActive[entityId] = airborne ? 1 : 0;
    }
    state.group.setAirborneEffect(entityId, airborne, elevation);
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

function updateKnockback(
  state: BattlefieldMonsterEffectGroupState,
  entityId: number,
  deltaTime: number,
  inverseScale: number,
): void {
  const remaining = state.knockbackRemaining[entityId] ?? 0;
  if (remaining <= 0) {
    return;
  }
  const duration = Math.max(state.knockbackDuration[entityId] ?? remaining, EFFECT_EPSILON);
  const speed = (state.knockbackSpeed[entityId] ?? 0) * remaining / duration;
  const crowd = state.group.crowdPopulation;
  crowd.x[entityId] = (crowd.x[entityId] ?? 0)
    + (state.knockbackDirectionX[entityId] ?? 0) * speed * deltaTime * inverseScale;
  crowd.y[entityId] = (crowd.y[entityId] ?? 0)
    - (state.knockbackDirectionZ[entityId] ?? 0) * speed * deltaTime * inverseScale;
  state.knockbackRemaining[entityId] = Math.max(0, remaining - deltaTime);
}

function validateKnockback(effect: Readonly<PlanarKnockbackEffect>): void {
  if (![effect.directionX, effect.directionZ, effect.initialSpeed,
    effect.remainingSeconds, effect.resistanceScale, effect.maximumSpeed].every(Number.isFinite)
    || Math.abs(Math.hypot(effect.directionX, effect.directionZ) - 1) > 0.001
    || effect.initialSpeed < 0
    || effect.remainingSeconds <= 0
    || effect.resistanceScale < 0
    || effect.maximumSpeed <= 0
    || (effect.combineMode !== PlanarKnockbackCombineMode.Replace
      && effect.combineMode !== PlanarKnockbackCombineMode.Accumulate)) {
    throw new Error('平面击退 Effect 参数无效。');
  }
}

function validateDirectionalLaunch(effect: Readonly<DirectionalLaunchEffect>): void {
  if (![effect.directionX, effect.directionZ, effect.targetHeight,
    effect.horizontalSpeed, effect.horizontalDrag, effect.gravityScale].every(Number.isFinite)
    || Math.abs(Math.hypot(effect.directionX, effect.directionZ) - 1) > 0.001
    || effect.targetHeight < 0
    || effect.horizontalSpeed < 0
    || effect.horizontalDrag < 0
    || effect.gravityScale <= 0) {
    throw new Error('方向腾空 Effect 参数无效。');
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
  state.airborneVelocityX[entityId] = 0;
  state.airborneVelocityZ[entityId] = 0;
  state.airborneHorizontalDrag[entityId] = 0;
  state.airborneActive[entityId] = 0;
  state.kineticRemaining[entityId] = 0;
  state.kineticSequence[entityId] = 0;
  state.kineticDamageBudget[entityId] = 0;
}

/** 把当前线性衰减后的实际速度与新增击退速度按向量相加。 */
function accumulateKnockback(
  state: BattlefieldMonsterEffectGroupState,
  entityId: number,
  effect: Readonly<PlanarKnockbackEffect>,
  resistance: number,
): boolean {
  const remaining = state.knockbackRemaining[entityId] ?? 0;
  const duration = Math.max(state.knockbackDuration[entityId] ?? remaining, EFFECT_EPSILON);
  const currentSpeed = (state.knockbackSpeed[entityId] ?? 0) * remaining / duration;
  const nextVelocityX = (state.knockbackDirectionX[entityId] ?? 0) * currentSpeed
    + effect.directionX * effect.initialSpeed * resistance;
  const nextVelocityZ = (state.knockbackDirectionZ[entityId] ?? 0) * currentSpeed
    + effect.directionZ * effect.initialSpeed * resistance;
  const rawSpeed = Math.hypot(nextVelocityX, nextVelocityZ);
  if (rawSpeed <= EFFECT_EPSILON) {
    state.knockbackSpeed[entityId] = 0;
    state.knockbackRemaining[entityId] = 0;
    state.knockbackDuration[entityId] = 0;
    return true;
  }
  state.knockbackDirectionX[entityId] = nextVelocityX / rawSpeed;
  state.knockbackDirectionZ[entityId] = nextVelocityZ / rawSpeed;
  state.knockbackSpeed[entityId] = Math.min(rawSpeed, effect.maximumSpeed);
  const nextRemaining = Math.max(remaining, effect.remainingSeconds);
  state.knockbackRemaining[entityId] = nextRemaining;
  state.knockbackDuration[entityId] = nextRemaining;
  return true;
}
