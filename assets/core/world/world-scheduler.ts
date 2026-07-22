import { type WorldSystem } from './world-system';

/** 初始化阶段排序、运行阶段按稳定数组顺序推进的轻量 Scheduler。 */
export class WorldScheduler<TWorld> {
  private readonly systems: WorldSystem<TWorld>[] = [];
  private sealed = false;

  /** 在运行前登记系统；封存后禁止结构变化。 */
  public register(system: WorldSystem<TWorld>): void {
    if (this.sealed) {
      throw new Error('World Scheduler 封存后不能继续注册系统。');
    }
    if (!Number.isInteger(system.order)) {
      throw new Error('World System 顺序必须是整数。');
    }
    this.systems.push(system);
  }

  /** 在初始化阶段完成唯一一次排序并锁定系统结构。 */
  public seal(): void {
    if (this.sealed) {
      return;
    }
    this.systems.sort(compareWorldSystems);
    this.sealed = true;
  }

  /** 按稳定阶段顺序推进所有系统。 */
  public step(world: TWorld, deltaTime: number): void {
    if (!this.sealed) {
      throw new Error('World Scheduler 必须先封存再运行。');
    }
    if (!Number.isFinite(deltaTime) || deltaTime < 0) {
      throw new Error('World Scheduler 帧时间必须是有限非负数值。');
    }
    for (let index = 0; index < this.systems.length; index++) {
      const system = this.systems[index];
      if (system === undefined) {
        throw new Error('World Scheduler 系统槽位缺失。');
      }
      system.update(world, deltaTime);
    }
  }
}

function compareWorldSystems<TWorld>(
  left: WorldSystem<TWorld>,
  right: WorldSystem<TWorld>,
): number {
  return left.phase - right.phase || left.order - right.order;
}
