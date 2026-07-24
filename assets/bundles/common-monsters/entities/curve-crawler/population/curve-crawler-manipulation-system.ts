import { MonsterLifecycleState } from '../../../../../core/contracts/monster-lifecycle';
import {
  CombatTag,
  type MutablePlanarMonsterManipulationCandidate,
  MonsterBodySize,
  MonsterManipulationState,
} from '../../../../../core/contracts/monster-manipulation';
import { calculateCurveCrawlerAimElevation } from '../model/curve-crawler-combat-volume';
import { CURVE_CRAWLER_MANIPULATION_PROFILE } from '../model/curve-crawler-manipulation';
import { CURVE_CRAWLER_FRAGMENT_COUNT } from '../model/curve-crawler-schema';
import { type CurveCrawlerState } from '../model/curve-crawler-state';
import { CurveCrawlerAction } from '../model/curve-crawler-action';
import { CURVE_CRAWLER_MAX_HEALTH } from '../model/curve-crawler-life';

/** 管理单只 Curve Crawler 被携带和投掷期间的领域状态与权威姿态。 */
export class CurveCrawlerManipulationSystem {
  /** 写出仍存活且未被其他行为接管的实体能力。 */
  public writeCandidate(
    state: CurveCrawlerState,
    entityIndex: number,
    result: MutablePlanarMonsterManipulationCandidate,
  ): boolean {
    validateEntityIndex(state, entityIndex);
    const { identity, transform, morphology, vitality, animation, manipulation } = state.data;
    if ((vitality.state[entityIndex] as MonsterLifecycleState) !== MonsterLifecycleState.Alive
      || (manipulation.state[entityIndex] as MonsterManipulationState)
        !== MonsterManipulationState.Free) {
      return false;
    }
    const bodyWidth = morphology.bodyWidth[entityIndex] ?? 0;
    result.entityId = identity.id[entityIndex] ?? entityIndex;
    result.x = transform.x[entityIndex] ?? 0;
    result.y = transform.y[entityIndex] ?? 0;
    result.elevation = calculateCurveCrawlerAimElevation(
      bodyWidth,
      animation.bodyPulse[entityIndex] ?? 0,
      animation.crouchAmount[entityIndex] ?? 0,
      animation.biteAmount[entityIndex] ?? 0,
    );
    result.healthRatio = (vitality.health[entityIndex] ?? 0) / CURVE_CRAWLER_MAX_HEALTH;
    result.bodySize = (manipulation.bodySize[entityIndex] ?? 0) as MonsterBodySize;
    result.grabResistance = manipulation.grabResistance[entityIndex] ?? 0;
    result.playerGrabbable = (manipulation.playerGrabbable[entityIndex] ?? 0) !== 0;
    result.tags = (manipulation.tags[entityIndex] ?? CombatTag.None) as CombatTag;
    result.throwMass = manipulation.throwMass[entityIndex] ?? 0;
    result.maximumThrowDistance = manipulation.maximumThrowDistance[entityIndex] ?? 0;
    result.collisionRadius = manipulation.collisionRadius[entityIndex] ?? 0;
    result.impactStrength = manipulation.impactStrength[entityIndex] ?? 0;
    return (manipulation.grabbable[entityIndex] ?? 0) !== 0;
  }

  /** 验证可处决标签并进入携带状态，同时清理移动和攻击占用。 */
  public beginCarry(state: CurveCrawlerState, entityId: number): boolean {
    validateEntityIndex(state, entityId);
    const { vitality, manipulation } = state.data;
    if ((vitality.state[entityId] as MonsterLifecycleState) !== MonsterLifecycleState.Alive
      || (manipulation.state[entityId] as MonsterManipulationState)
        !== MonsterManipulationState.Free
      || (manipulation.grabbable[entityId] ?? 0) === 0
      || (manipulation.playerGrabbable[entityId] ?? 0) === 0
      || ((manipulation.tags[entityId] ?? 0) & CombatTag.Executable) === 0) {
      return false;
    }
    manipulation.state[entityId] = MonsterManipulationState.Carried;
    this.stopAutonomousAction(state, entityId);
    return true;
  }

  /** 只允许当前携带对象进入投掷状态。 */
  public beginThrow(state: CurveCrawlerState, entityId: number): boolean {
    validateEntityIndex(state, entityId);
    if ((state.data.manipulation.state[entityId] as MonsterManipulationState)
      !== MonsterManipulationState.Carried) {
      return false;
    }
    state.data.manipulation.state[entityId] = MonsterManipulationState.Thrown;
    return true;
  }

  /** 同步被接管实体的平面姿态，并用既有碎块高度流整体抬升可见模型。 */
  public synchronizePose(
    state: CurveCrawlerState,
    entityId: number,
    x: number,
    y: number,
    elevation: number,
    heading: number,
  ): boolean {
    validateEntityIndex(state, entityId);
    if (!Number.isFinite(x)
      || !Number.isFinite(y)
      || !Number.isFinite(elevation)
      || !Number.isFinite(heading)
      || elevation < 0) {
      throw new Error('Curve Crawler 操作姿态必须使用有限坐标和非负高度。');
    }
    if ((state.data.manipulation.state[entityId] as MonsterManipulationState)
      === MonsterManipulationState.Free) {
      return false;
    }
    const { transform } = state.data;
    transform.previousX[entityId] = transform.x[entityId] ?? x;
    transform.previousY[entityId] = transform.y[entityId] ?? y;
    transform.x[entityId] = x;
    transform.y[entityId] = y;
    transform.heading[entityId] = heading;
    transform.headingCosine[entityId] = Math.cos(heading);
    transform.headingSine[entityId] = Math.sin(heading);
    transform.targetHeading[entityId] = heading;
    this.writeElevation(state, entityId, elevation);
    return true;
  }

  /** 恢复自由状态并把可见模型放回地面。 */
  public release(state: CurveCrawlerState, entityId: number): boolean {
    validateEntityIndex(state, entityId);
    const manipulation = state.data.manipulation;
    if ((manipulation.state[entityId] as MonsterManipulationState)
      === MonsterManipulationState.Free) {
      return false;
    }
    manipulation.state[entityId] = MonsterManipulationState.Free;
    this.writeElevation(state, entityId, 0);
    this.stopAutonomousAction(state, entityId);
    return true;
  }

  /** 判断实体当前是否正被外部行为接管。 */
  public isManipulated(state: CurveCrawlerState, entityIndex: number): boolean {
    return (state.data.manipulation.state[entityIndex] as MonsterManipulationState)
      !== MonsterManipulationState.Free;
  }

  private stopAutonomousAction(state: CurveCrawlerState, entityIndex: number): void {
    const { behavior, combat, intent, motion, animation } = state.data;
    behavior.action[entityIndex] = CurveCrawlerAction.Pause;
    behavior.actionTime[entityIndex] = 0;
    behavior.actionDuration[entityIndex] = 0;
    combat.engaged[entityIndex] = 0;
    combat.attackTime[entityIndex] = 0;
    combat.attackCooldown[entityIndex] = 0;
    combat.impactApplied[entityIndex] = 0;
    intent.targetSpeed[entityIndex] = 0;
    intent.targetCrouch[entityIndex] = 0.18;
    intent.targetBite[entityIndex] = 0;
    intent.targetTurn[entityIndex] = 0;
    intent.gaitMultiplier[entityIndex] = 0;
    motion.currentSpeed[entityIndex] = 0;
    animation.biteAmount[entityIndex] = 0;
  }

  private writeElevation(state: CurveCrawlerState, entityIndex: number, elevation: number): void {
    const offsets = state.data.animation.fragmentOffsetZ;
    const first = entityIndex * CURVE_CRAWLER_FRAGMENT_COUNT;
    for (let fragment = 0; fragment < CURVE_CRAWLER_FRAGMENT_COUNT; fragment++) {
      offsets[first + fragment] = elevation;
    }
  }
}

/** 根据当前生命比例刷新统一的可处决标签。 */
export function synchronizeCurveCrawlerExecutableTag(
  state: CurveCrawlerState,
  entityIndex: number,
): void {
  const { vitality, manipulation } = state.data;
  const threshold = manipulation.executableHealthRatio[entityIndex]
    ?? CURVE_CRAWLER_MANIPULATION_PROFILE.executableHealthRatio;
  const healthRatio = (vitality.health[entityIndex] ?? 0) / CURVE_CRAWLER_MAX_HEALTH;
  const current = manipulation.tags[entityIndex] ?? CombatTag.None;
  manipulation.tags[entityIndex] = healthRatio < threshold
    ? current | CombatTag.Executable
    : current & ~CombatTag.Executable;
}

function validateEntityIndex(state: CurveCrawlerState, entityIndex: number): void {
  if (!Number.isSafeInteger(entityIndex) || entityIndex < 0 || entityIndex >= state.count) {
    throw new Error(`Curve Crawler 操作实体索引越界：${entityIndex}`);
  }
}
