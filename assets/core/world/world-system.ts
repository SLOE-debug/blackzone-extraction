import { type WorldPhase } from './world-phase';

/** 由 World Scheduler 按阶段和顺序推进的无分配系统契约。 */
export interface WorldSystem<TWorld> {
  readonly phase: WorldPhase;
  readonly order: number;
  update(world: TWorld, deltaTime: number): void;
}
