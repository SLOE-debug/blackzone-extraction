import { MonsterLifecycleState } from '../../../../../core/contracts/monster-lifecycle';
import {
  CombatTag,
  type MutablePlanarMonsterManipulationCandidate,
  type MonsterBodySize,
  MonsterManipulationState,
} from '../../../../../core/contracts/monster-manipulation';
import { VenomLobberAction } from '../model/venom-lobber-action';
import { VENOM_LOBBER_MANIPULATION_PROFILE } from '../model/venom-lobber-manipulation';
import {
  VENOM_LOBBER_MAX_HEALTH,
  type VenomLobberState,
} from '../model/venom-lobber-state';

/** 管理 Venom Lobber 被携带和投掷期间的领域状态、施法取消与权威姿态。 */
export class VenomLobberManipulationSystem {
  /** 写出仍存活、自由且低于处决阈值的中型怪操作能力。 */
  public writeCandidate(
    state: VenomLobberState,
    entityIndex: number,
    result: MutablePlanarMonsterManipulationCandidate,
  ): boolean {
    validateEntityIndex(state, entityIndex);
    this.synchronizeExecutableTag(state, entityIndex);
    const { identity, transform, morphology, vitality, manipulation } = state.data;
    if ((vitality.state[entityIndex] as MonsterLifecycleState) !== MonsterLifecycleState.Alive
      || (manipulation.state[entityIndex] as MonsterManipulationState)
        !== MonsterManipulationState.Free) {
      return false;
    }
    const scale = morphology.scale[entityIndex] ?? 1;
    result.entityId = identity.id[entityIndex] ?? entityIndex;
    result.x = transform.x[entityIndex] ?? 0;
    result.y = transform.y[entityIndex] ?? 0;
    result.elevation = 2.55 * scale;
    result.healthRatio = (vitality.health[entityIndex] ?? 0) / VENOM_LOBBER_MAX_HEALTH;
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

  /** 进入携带状态并取消移动、近战以及尚未释放的毒弹施法。 */
  public beginCarry(state: VenomLobberState, entityId: number): boolean {
    validateEntityIndex(state, entityId);
    this.synchronizeExecutableTag(state, entityId);
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
    manipulation.elevation[entityId] = 0;
    this.stopAutonomousAction(state, entityId);
    return true;
  }

  public beginThrow(state: VenomLobberState, entityId: number): boolean {
    validateEntityIndex(state, entityId);
    if ((state.data.manipulation.state[entityId] as MonsterManipulationState)
      !== MonsterManipulationState.Carried) {
      return false;
    }
    state.data.manipulation.state[entityId] = MonsterManipulationState.Thrown;
    return true;
  }

  /** 同步外部接管的平面位置、正交高度和朝向。 */
  public synchronizePose(
    state: VenomLobberState,
    entityId: number,
    x: number,
    y: number,
    elevation: number,
    heading: number,
  ): boolean {
    validateEntityIndex(state, entityId);
    if (![x, y, elevation, heading].every(Number.isFinite) || elevation < 0) {
      throw new Error('Venom Lobber 操作姿态必须使用有限坐标和非负高度。');
    }
    if ((state.data.manipulation.state[entityId] as MonsterManipulationState)
      === MonsterManipulationState.Free) {
      return false;
    }
    const { transform, manipulation } = state.data;
    transform.previousX[entityId] = transform.x[entityId] ?? x;
    transform.previousY[entityId] = transform.y[entityId] ?? y;
    transform.x[entityId] = x;
    transform.y[entityId] = y;
    transform.heading[entityId] = heading;
    transform.targetHeading[entityId] = heading;
    manipulation.elevation[entityId] = elevation;
    return true;
  }

  /** 生命周期姿态之后重新施加外部高度，防止携带模型被中立姿态归零。 */
  public applyPose(state: VenomLobberState): void {
    const { manipulation, animation } = state.data;
    for (let index = 0; index < state.count; index++) {
      if ((manipulation.state[index] as MonsterManipulationState)
        === MonsterManipulationState.Free) {
        continue;
      }
      animation.rootElevation[index] = manipulation.elevation[index] ?? 0;
    }
  }

  public release(state: VenomLobberState, entityId: number): boolean {
    validateEntityIndex(state, entityId);
    const manipulation = state.data.manipulation;
    if ((manipulation.state[entityId] as MonsterManipulationState)
      === MonsterManipulationState.Free) {
      return false;
    }
    manipulation.state[entityId] = MonsterManipulationState.Free;
    manipulation.elevation[entityId] = 0;
    state.data.animation.rootElevation[entityId] = 0;
    this.stopAutonomousAction(state, entityId);
    return true;
  }

  /** 根据当前生命比例刷新统一处决标签。 */
  public updateTags(state: VenomLobberState): void {
    for (let index = 0; index < state.count; index++) {
      this.synchronizeExecutableTag(state, index);
    }
  }

  /** 根据当前生命比例刷新单个实体的统一处决标签。 */
  public synchronizeExecutableTag(state: VenomLobberState, entityIndex: number): void {
    const { vitality, manipulation } = state.data;
    const threshold = manipulation.executableHealthRatio[entityIndex]
      ?? VENOM_LOBBER_MANIPULATION_PROFILE.executableHealthRatio;
    const healthRatio = (vitality.health[entityIndex] ?? 0) / VENOM_LOBBER_MAX_HEALTH;
    const current = manipulation.tags[entityIndex] ?? CombatTag.None;
    manipulation.tags[entityIndex] = healthRatio < threshold
      ? current | CombatTag.Executable
      : current & ~CombatTag.Executable;
  }

  private stopAutonomousAction(state: VenomLobberState, entityIndex: number): void {
    const { behavior, combat, intent, motion, animation } = state.data;
    behavior.action[entityIndex] = VenomLobberAction.Roam;
    behavior.actionTime[entityIndex] = 0;
    combat.engaged[entityIndex] = 0;
    combat.castTime[entityIndex] = 0;
    combat.projectileReleased[entityIndex] = 0;
    combat.meleeTime[entityIndex] = 0;
    combat.meleeHitApplied[entityIndex] = 0;
    intent.targetSpeed[entityIndex] = 0;
    motion.currentSpeed[entityIndex] = 0;
    animation.tailCharge[entityIndex] = 0;
    animation.sacPulse[entityIndex] = 0;
  }
}

function validateEntityIndex(state: VenomLobberState, entityIndex: number): void {
  if (!Number.isSafeInteger(entityIndex) || entityIndex < 0 || entityIndex >= state.count) {
    throw new Error(`Venom Lobber 操作实体索引越界：${entityIndex}`);
  }
}
