import { WorldPhase } from '../../../../core/world/world-phase';
import { BattlefieldPerformanceStage } from '../../debug/battlefield-performance-contracts';
import { type BattlefieldWorld } from '../battlefield-world';
import { BattlefieldWorldSystem } from './battlefield-world-system';

/** 在 Simulation 阶段保存弹丸旧位置并推进到本帧终点。 */
export class BattlefieldProjectileIntegrationWorldSystem extends BattlefieldWorldSystem {
  public readonly phase = WorldPhase.Simulation;
  public readonly order = 10;
  protected readonly performanceStage = BattlefieldPerformanceStage.Weapon;

  protected execute(world: BattlefieldWorld, deltaTime: number): void {
    world.resources.weapon.integrateProjectiles(deltaTime);
  }
}
