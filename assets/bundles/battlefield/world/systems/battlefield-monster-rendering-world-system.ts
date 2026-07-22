import { WorldPhase } from '../../../../core/world/world-phase';
import { BattlefieldPerformanceStage } from '../../debug/battlefield-performance-contracts';
import { type BattlefieldWorld } from '../battlefield-world';
import { BattlefieldWorldSystem } from './battlefield-world-system';

/** 在伤害与生命周期变化后整理并上传怪物可见状态。 */
export class BattlefieldMonsterRenderingWorldSystem extends BattlefieldWorldSystem {
  public readonly phase = WorldPhase.RenderPreparation;
  public readonly order = 0;
  protected readonly performanceStage = BattlefieldPerformanceStage.Monsters;

  protected execute(world: BattlefieldWorld, deltaTime: number): void {
    const { monsters, performance } = world.resources;
    monsters.synchronizeRendering(deltaTime, performance);
  }
}
