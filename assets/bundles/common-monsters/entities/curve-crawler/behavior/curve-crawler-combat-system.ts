import { type PlanarMonsterCombatTarget } from '../../../../../core/contracts/monster-combat';
import { MonsterLifecycleState } from '../../../../../core/contracts/monster-lifecycle';
import { type EntitySystem } from '../../../../../core/entities/entity-system';
import { CurveCrawlerAction } from '../model/curve-crawler-action';
import { type CurveCrawlerCombatOptions } from '../model/curve-crawler-combat-options';
import { type CurveCrawlerState } from '../model/curve-crawler-state';

const PURSUIT_TURN_RATE = 8.5;
const PURSUIT_GAIT_MULTIPLIER = 2.2;
const PURSUIT_SPEED_SHARPNESS = 9;
const ATTACK_TURN_RATE = 10;
const ATTACK_WAIT_GAIT_MULTIPLIER = 0.16;
const ATTACK_BRAKE_SHARPNESS = 42;
const BITE_WINDUP_CROUCH = 0.68;

/** 负责目标感知、快速追击、贴身啃咬和攻击伤害事件。 */
export class CurveCrawlerCombatSystem implements EntitySystem<CurveCrawlerState, number> {
  private targetActive = false;
  private targetX = 0;
  private targetY = 0;
  private targetCollisionRadius = 0;
  private pendingAttackDamage = 0;

  constructor(private readonly options: Readonly<CurveCrawlerCombatOptions>) {}

  /** 保存当前目标的局部平面位置，供下一次群体更新使用。 */
  public synchronizeTarget(target: Readonly<PlanarMonsterCombatTarget>): void {
    if (!Number.isFinite(target.x)
      || !Number.isFinite(target.y)
      || !Number.isFinite(target.collisionRadius)
      || target.collisionRadius < 0) {
      throw new Error('Curve Crawler 战斗目标必须使用有限坐标和非负碰撞半径。');
    }
    this.targetX = target.x;
    this.targetY = target.y;
    this.targetCollisionRadius = target.collisionRadius;
    this.targetActive = true;
  }

  /** 立即取消全部感知和未命中攻击，不把旧目标状态带到后续帧。 */
  public clearTarget(state: CurveCrawlerState): void {
    this.targetActive = false;
    this.pendingAttackDamage = 0;
    for (let index = 0; index < state.count; index++) {
      this.disengage(state, index);
    }
  }

  /** 取走全部已经通过命中距离校验的聚合伤害。 */
  public consumeAttackDamage(): number {
    const damage = this.pendingAttackDamage;
    this.pendingAttackDamage = 0;
    return damage;
  }

  /** 按感知、追击、独立冷却和啃咬时间轴推进全部存活实体。 */
  public update(state: CurveCrawlerState, deltaTime: number): void {
    const { vitality, behavior, combat } = state.data;

    for (let index = 0; index < state.count; index++) {
      combat.attackCooldown[index] = Math.max(
        0,
        (combat.attackCooldown[index] ?? 0) - deltaTime,
      );
      const wasBiting = (behavior.action[index] as CurveCrawlerAction)
        === CurveCrawlerAction.Bite;
      if ((vitality.state[index] as MonsterLifecycleState) !== MonsterLifecycleState.Alive) {
        this.disengage(state, index);
        continue;
      }
      if (!this.targetActive) {
        this.disengage(state, index);
        continue;
      }

      const deltaX = this.targetX - (state.data.transform.x[index] ?? 0);
      const deltaY = this.targetY - (state.data.transform.y[index] ?? 0);
      const distanceSquared = deltaX * deltaX + deltaY * deltaY;
      const engaged = (combat.engaged[index] ?? 0) !== 0;
      if (!engaged) {
        if (distanceSquared > this.options.detectionRadius * this.options.detectionRadius) {
          continue;
        }
        combat.engaged[index] = 1;
      } else if (distanceSquared
        > this.options.disengageRadius * this.options.disengageRadius) {
        this.disengage(state, index);
        continue;
      }

      state.data.transform.targetHeading[index] = Math.atan2(deltaY, deltaX);
      if (wasBiting) {
        this.updateBite(state, index, deltaTime, distanceSquared);
        continue;
      }

      const attackDistance = this.targetCollisionRadius + this.options.attackReach;
      if (distanceSquared > attackDistance * attackDistance) {
        this.pursue(state, index);
        continue;
      }
      if ((combat.attackCooldown[index] ?? 0) <= 0) {
        this.startBite(state, index);
        continue;
      }
      this.waitAtTarget(state, index);
    }
  }

  /** 覆盖自主游荡意图，快速贴地爬向目标。 */
  private pursue(state: CurveCrawlerState, index: number): void {
    const { morphology, behavior, combat, intent } = state.data;
    behavior.action[index] = CurveCrawlerAction.Pursue;
    behavior.actionTime[index] = 0;
    behavior.actionDuration[index] = 0;
    combat.attackTime[index] = 0;
    combat.impactApplied[index] = 0;
    intent.targetSpeed[index] = (morphology.cruiseSpeed[index] ?? 0)
      * this.options.pursuitSpeedMultiplier;
    intent.speedSharpness[index] = PURSUIT_SPEED_SHARPNESS;
    intent.targetCrouch[index] = 0.1;
    intent.targetBite[index] = 0;
    intent.targetTurn[index] = 0;
    intent.gaitMultiplier[index] = PURSUIT_GAIT_MULTIPLIER;
    intent.gaitDirection[index] = 1;
    intent.turnRate[index] = PURSUIT_TURN_RATE;
  }

  /** 贴身但自身冷却尚未结束时保持朝向并原地蓄势。 */
  private waitAtTarget(state: CurveCrawlerState, index: number): void {
    const { behavior, combat, intent } = state.data;
    behavior.action[index] = CurveCrawlerAction.Pause;
    behavior.actionTime[index] = 0;
    behavior.actionDuration[index] = 0;
    combat.attackTime[index] = 0;
    combat.impactApplied[index] = 0;
    intent.targetSpeed[index] = 0;
    intent.speedSharpness[index] = ATTACK_BRAKE_SHARPNESS;
    intent.targetCrouch[index] = 0.16;
    intent.targetBite[index] = 0;
    intent.targetTurn[index] = 0;
    intent.gaitMultiplier[index] = ATTACK_WAIT_GAIT_MULTIPLIER;
    intent.gaitDirection[index] = 1;
    intent.turnRate[index] = ATTACK_TURN_RATE;
  }

  /** 进入一次完整啃咬时间轴，伤害仍需等待命中时刻。 */
  private startBite(state: CurveCrawlerState, index: number): void {
    const { behavior, combat, intent } = state.data;
    const duration = this.getBiteDuration();
    behavior.action[index] = CurveCrawlerAction.Bite;
    behavior.actionTime[index] = duration;
    behavior.actionDuration[index] = duration;
    combat.attackTime[index] = 0;
    combat.impactApplied[index] = 0;
    intent.targetSpeed[index] = 0;
    intent.speedSharpness[index] = ATTACK_BRAKE_SHARPNESS;
    intent.targetCrouch[index] = 0.16;
    intent.targetBite[index] = 0;
    intent.targetTurn[index] = 0;
    intent.gaitMultiplier[index] = ATTACK_WAIT_GAIT_MULTIPLIER;
    intent.gaitDirection[index] = 1;
    intent.turnRate[index] = ATTACK_TURN_RATE;
  }

  /** 推进蓄力、头胸前探和回收阶段，并在唯一命中帧结算伤害。 */
  private updateBite(
    state: CurveCrawlerState,
    index: number,
    deltaTime: number,
    targetDistanceSquared: number,
  ): void {
    const { behavior, combat, intent } = state.data;
    const timing = this.options.biteTiming;
    const strikeStart = timing.windupSeconds;
    const recoveryStart = strikeStart + timing.strikeSeconds;
    const duration = recoveryStart + timing.recoverySeconds;
    const elapsed = Math.min(duration, (combat.attackTime[index] ?? 0) + deltaTime);
    combat.attackTime[index] = elapsed;
    behavior.actionTime[index] = duration - elapsed;
    intent.targetSpeed[index] = 0;
    intent.speedSharpness[index] = ATTACK_BRAKE_SHARPNESS;
    intent.targetTurn[index] = 0;
    intent.gaitMultiplier[index] = ATTACK_WAIT_GAIT_MULTIPLIER;
    intent.gaitDirection[index] = 1;
    intent.turnRate[index] = ATTACK_TURN_RATE;

    if (elapsed < strikeStart) {
      const progress = smoothStep(elapsed / timing.windupSeconds);
      intent.targetCrouch[index] = BITE_WINDUP_CROUCH * progress;
      intent.targetBite[index] = 0;
    } else if (elapsed < recoveryStart) {
      const progress = (elapsed - strikeStart) / timing.strikeSeconds;
      intent.targetCrouch[index] = BITE_WINDUP_CROUCH * (1 - smoothStep(progress));
      intent.targetBite[index] = smoothStep(Math.min(1, progress / 0.34));
    } else {
      const progress = (elapsed - recoveryStart) / timing.recoverySeconds;
      intent.targetCrouch[index] = 0.12 * (1 - smoothStep(progress));
      intent.targetBite[index] = 1 - smoothStep(progress);
    }

    const impactTime = strikeStart + timing.strikeSeconds * 0.42;
    if ((combat.impactApplied[index] ?? 0) === 0 && elapsed >= impactTime) {
      combat.impactApplied[index] = 1;
      const maximumImpactDistance = this.targetCollisionRadius
        + this.options.attackReach
        + this.options.impactTolerance;
      if (targetDistanceSquared <= maximumImpactDistance * maximumImpactDistance) {
        this.pendingAttackDamage += this.options.damage;
      }
    }

    if (elapsed < duration) {
      return;
    }
    combat.attackTime[index] = 0;
    combat.attackCooldown[index] = timing.cooldownSeconds;
    combat.impactApplied[index] = 0;
    this.waitAtTarget(state, index);
  }

  /** 清理单个实体的战斗占用和残留姿态意图。 */
  private disengage(state: CurveCrawlerState, index: number): void {
    const { behavior, combat, intent } = state.data;
    combat.engaged[index] = 0;
    combat.attackTime[index] = 0;
    combat.attackCooldown[index] = 0;
    combat.impactApplied[index] = 0;
    behavior.action[index] = CurveCrawlerAction.Crawl;
    behavior.actionTime[index] = 0;
    behavior.actionDuration[index] = 0;
    intent.targetSpeed[index] = 0;
    intent.speedSharpness[index] = ATTACK_BRAKE_SHARPNESS;
    intent.targetCrouch[index] = 0;
    intent.targetBite[index] = 0;
    intent.targetTurn[index] = 0;
    intent.gaitMultiplier[index] = 0;
  }

  /** 取得不含冷却阶段的单次姿态时间轴长度。 */
  private getBiteDuration(): number {
    const timing = this.options.biteTiming;
    return timing.windupSeconds + timing.strikeSeconds + timing.recoverySeconds;
  }
}

/** 在零到一范围内生成平滑起止的姿态插值。 */
function smoothStep(value: number): number {
  const amount = Math.max(0, Math.min(value, 1));
  return amount * amount * (3 - amount * 2);
}
