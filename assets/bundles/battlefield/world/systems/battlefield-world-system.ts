import { type WorldPhase } from '../../../../core/world/world-phase';
import { type WorldSystem } from '../../../../core/world/world-system';
import { type BattlefieldPerformanceStage } from '../../debug/battlefield-performance-contracts';
import { type BattlefieldWorld } from '../battlefield-world';

/** 为战场 World System 统一记录原有性能阶段。 */
export abstract class BattlefieldWorldSystem implements WorldSystem<BattlefieldWorld> {
  public abstract readonly phase: WorldPhase;
  public abstract readonly order: number;
  protected abstract readonly performanceStage: BattlefieldPerformanceStage;

  public update(world: BattlefieldWorld, deltaTime: number): void {
    const performance = world.resources.performance;
    const startedAt = performance.beginStage();
    this.execute(world, deltaTime);
    performance.endStage(this.performanceStage, startedAt);
  }

  protected abstract execute(world: BattlefieldWorld, deltaTime: number): void;
}
