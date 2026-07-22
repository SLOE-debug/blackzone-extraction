import { WorldPhase } from '../../../../core/world/world-phase';
import { BattlefieldPerformanceStage } from '../../debug/battlefield-performance-contracts';
import { type BattlefieldWorld } from '../battlefield-world';
import { BattlefieldWorldSystem } from './battlefield-world-system';

/** 把碰撞后的权威弹丸位置上传到唯一曳光批次。 */
export class BattlefieldProjectileRenderingWorldSystem extends BattlefieldWorldSystem {
  public readonly phase = WorldPhase.RenderPreparation;
  public readonly order = 10;
  protected readonly performanceStage = BattlefieldPerformanceStage.Weapon;

  protected execute(world: BattlefieldWorld): void {
    world.resources.weapon.synchronizeProjectileRendering();
  }
}
