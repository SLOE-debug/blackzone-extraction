import { WorldPhase } from '../../../../core/world/world-phase';
import {
  BattlefieldPerformanceEvent,
  BattlefieldPerformanceStage,
} from '../../debug/battlefield-performance-contracts';
import { type BattlefieldWorld } from '../battlefield-world';
import { BattlefieldWorldSystem } from './battlefield-world-system';

/** 推进宝箱与掉落物生命周期。 */
export class BattlefieldTreasureWorldSystem extends BattlefieldWorldSystem {
  public readonly phase = WorldPhase.Presentation;
  public readonly order = 10;
  protected readonly performanceStage = BattlefieldPerformanceStage.Treasures;

  protected execute(world: BattlefieldWorld, deltaTime: number): void {
    const { treasures, performance } = world.resources;
    const releasedLootCount = treasures.update(deltaTime);
    if (releasedLootCount > 0) {
      performance.recordEvent(BattlefieldPerformanceEvent.LootReleased, releasedLootCount);
    }
  }
}
