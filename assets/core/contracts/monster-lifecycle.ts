/** 所有可进入战场怪物共享的顶层生命周期状态。 */
export enum MonsterLifecycleState {
  Dormant,
  Spawning,
  Alive,
  Despawning,
  Dying,
  DeathComplete,
}

/** 怪物 SoA 中由通用生命周期状态机拥有的最小字段集合。 */
export interface MonsterLifecycleSoA {
  readonly state: Uint8Array;
  readonly stateTime: Float32Array;
}

/** 判断一个槽位是否仍承载尚未结束的可见怪物生命周期。 */
export function isMonsterLifecycleResident(state: MonsterLifecycleState): boolean {
  return state === MonsterLifecycleState.Spawning
    || state === MonsterLifecycleState.Alive
    || state === MonsterLifecycleState.Despawning
    || state === MonsterLifecycleState.Dying;
}
