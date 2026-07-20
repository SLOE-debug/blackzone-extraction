import {
  isMonsterLifecycleResident,
  MonsterLifecycleState,
} from '../contracts/monster-lifecycle';

/** 通用激活调度器对任意具体怪物群体要求的最小适配契约。 */
export interface MonsterPopulationActivationTarget<TContext> {
  readonly capacity: number;
  getLifecycleState(entityIndex: number): MonsterLifecycleState;
  beginSpawning(
    entityIndex: number,
    context: Readonly<TContext>,
    delaySeconds: number,
  ): void;
}

/**
 * 在固定容量内把空闲槽位逐步激活到期望驻留数量。
 *
 * `Dying` 仍计入驻留数量，只有进入 `DeathComplete` 后槽位才允许重新出生，
 * 因而人口压力不会截断任何怪物自己的死亡动画。
 */
export class MonsterPopulationActivationSystem<TContext> {
  /** 返回本次从休眠或死亡完成状态启动的出生实体数量。 */
  public synchronize(
    target: MonsterPopulationActivationTarget<TContext>,
    context: Readonly<TContext>,
    desiredResidentCount: number,
    staggerSeconds: number,
  ): number {
    validateActivationOptions(target.capacity, desiredResidentCount, staggerSeconds);
    let residentCount = 0;
    for (let index = 0; index < target.capacity; index++) {
      if (isMonsterLifecycleResident(target.getLifecycleState(index))) {
        residentCount++;
      }
    }
    if (residentCount >= desiredResidentCount) {
      return 0;
    }

    let activatedCount = 0;
    for (let index = 0;
      index < target.capacity && residentCount < desiredResidentCount;
      index++) {
      const state = target.getLifecycleState(index);
      if (state !== MonsterLifecycleState.Dormant
        && state !== MonsterLifecycleState.DeathComplete) {
        continue;
      }
      target.beginSpawning(index, context, activatedCount * staggerSeconds);
      activatedCount++;
      residentCount++;
    }
    return activatedCount;
  }
}

function validateActivationOptions(
  capacity: number,
  desiredResidentCount: number,
  staggerSeconds: number,
): void {
  if (!Number.isInteger(capacity)
    || capacity <= 0
    || !Number.isInteger(desiredResidentCount)
    || desiredResidentCount < 0
    || desiredResidentCount > capacity
    || !Number.isFinite(staggerSeconds)
    || staggerSeconds < 0) {
    throw new Error('怪物激活容量、期望驻留数或出生错峰时间无效。');
  }
}
