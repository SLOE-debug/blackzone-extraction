import { WorldPhase } from '../../../../core/world/world-phase';
import { BattlefieldPerformanceStage } from '../../debug/battlefield-performance-contracts';
import { type BattlefieldWorld } from '../battlefield-world';
import { BattlefieldWorldSystem } from './battlefield-world-system';

/** 在全部怪物完成移动后求解 Crowd，并重建弹丸共享空间索引。 */
export class BattlefieldMonsterSpatialIndexWorldSystem extends BattlefieldWorldSystem {
  public readonly phase = WorldPhase.SpatialIndex;
  public readonly order = 0;
  protected readonly performanceStage = BattlefieldPerformanceStage.Monsters;

  protected execute(world: BattlefieldWorld, deltaTime: number): void {
    world.resources.monsters.rebuildSpatialIndex(deltaTime);
  }
}
