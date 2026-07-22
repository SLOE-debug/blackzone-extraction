import {
  type MonsterLifecycleSoA,
  MonsterLifecycleState,
} from '../contracts/monster-lifecycle';

/** 顶层怪物生命周期允许发生的完整有向状态转换。 */
const MONSTER_LIFECYCLE_TRANSITIONS = Object.freeze({
  [MonsterLifecycleState.Dormant]: Object.freeze([
    MonsterLifecycleState.Spawning,
  ]),
  [MonsterLifecycleState.Spawning]: Object.freeze([
    MonsterLifecycleState.Alive,
    MonsterLifecycleState.Dormant,
  ]),
  [MonsterLifecycleState.Alive]: Object.freeze([
    MonsterLifecycleState.Despawning,
    MonsterLifecycleState.Dying,
  ]),
  [MonsterLifecycleState.Despawning]: Object.freeze([
    MonsterLifecycleState.Dormant,
  ]),
  [MonsterLifecycleState.Dying]: Object.freeze([
    MonsterLifecycleState.DeathComplete,
  ]),
  [MonsterLifecycleState.DeathComplete]: Object.freeze([
    MonsterLifecycleState.Spawning,
    MonsterLifecycleState.Dormant,
  ]),
} satisfies Readonly<Record<MonsterLifecycleState, readonly MonsterLifecycleState[]>>);

/** 读取并校验指定 SoA 槽位的顶层怪物生命周期状态。 */
export function readMonsterLifecycleState(
  lifecycle: Readonly<MonsterLifecycleSoA>,
  entityIndex: number,
): MonsterLifecycleState {
  validateEntityIndex(lifecycle, entityIndex);
  const state = lifecycle.state[entityIndex] as MonsterLifecycleState;
  if (!(state in MONSTER_LIFECYCLE_TRANSITIONS)) {
    throw new Error(`怪物生命周期状态无效：${state}`);
  }
  return state;
}

/**
 * 执行一次受转换表约束的怪物生命周期切换，并重置新状态计时。
 *
 * 具体怪物的出生、爆裂、液化等子阶段仍由 Feature 内部系统拥有；通用状态机只
 * 管理能否生成、能否战斗、是否正在死亡以及死亡是否完整结束。
 */
export function transitionMonsterLifecycle(
  lifecycle: MonsterLifecycleSoA,
  entityIndex: number,
  nextState: MonsterLifecycleState,
  initialStateTime = 0,
): void {
  if (!Number.isFinite(initialStateTime)) {
    throw new Error('怪物生命周期初始计时必须是有限数值。');
  }
  const currentState = readMonsterLifecycleState(lifecycle, entityIndex);
  const allowedStates: readonly MonsterLifecycleState[] = MONSTER_LIFECYCLE_TRANSITIONS[
    currentState
  ];
  if (!allowedStates.includes(nextState)) {
    throw new Error(`怪物生命周期禁止从 ${currentState} 转换到 ${nextState}。`);
  }
  lifecycle.state[entityIndex] = nextState;
  lifecycle.stateTime[entityIndex] = initialStateTime;
}

/** 推进当前顶层状态的连续计时并返回更新后的秒数。 */
export function advanceMonsterLifecycleTime(
  lifecycle: MonsterLifecycleSoA,
  entityIndex: number,
  deltaTime: number,
): number {
  validateEntityIndex(lifecycle, entityIndex);
  if (!Number.isFinite(deltaTime) || deltaTime < 0) {
    throw new Error('怪物生命周期帧时间必须是有限非负数。');
  }
  const nextTime = (lifecycle.stateTime[entityIndex] ?? 0) + deltaTime;
  lifecycle.stateTime[entityIndex] = nextTime;
  return nextTime;
}

function validateEntityIndex(
  lifecycle: Readonly<MonsterLifecycleSoA>,
  entityIndex: number,
): void {
  if (!Number.isInteger(entityIndex)
    || entityIndex < 0
    || entityIndex >= lifecycle.state.length
    || lifecycle.stateTime.length !== lifecycle.state.length) {
    throw new Error(`怪物生命周期 SoA 槽位无效：${entityIndex}`);
  }
}
