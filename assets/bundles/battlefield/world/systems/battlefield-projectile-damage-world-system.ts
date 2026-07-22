import { WorldPhase } from '../../../../core/world/world-phase';
import { BattlefieldPerformanceStage } from '../../debug/battlefield-performance-contracts';
import { type BattlefieldWorld } from '../battlefield-world';
import { BattlefieldWorldSystem } from './battlefield-world-system';

/** 在 PostSimulation 阶段统一路由本帧实体弹丸命中。 */
export class BattlefieldProjectileDamageWorldSystem extends BattlefieldWorldSystem {
  public readonly phase = WorldPhase.PostSimulation;
  public readonly order = 0;
  protected readonly performanceStage = BattlefieldPerformanceStage.Weapon;

  protected execute(world: BattlefieldWorld): void {
    const { weapon, monsters } = world.resources;
    weapon.resolveProjectileImpacts(monsters);
  }
}
