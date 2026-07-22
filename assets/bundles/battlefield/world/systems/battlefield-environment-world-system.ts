import { WorldPhase } from '../../../../core/world/world-phase';
import {
  BattlefieldPerformanceEvent,
  BattlefieldPerformanceStage,
} from '../../debug/battlefield-performance-contracts';
import { type BattlefieldWorld } from '../battlefield-world';
import { BattlefieldWorldSystem } from './battlefield-world-system';

/** 同步环境 Chunk 窗口、空间约束和 Chunk 作用域。 */
export class BattlefieldEnvironmentWorldSystem extends BattlefieldWorldSystem {
  public readonly phase = WorldPhase.SpatialIndex;
  public readonly order = 0;
  protected readonly performanceStage = BattlefieldPerformanceStage.Environment;

  protected execute(world: BattlefieldWorld): void {
    const { player, environment, chunks, performance } = world.resources;
    environment.update(player.positionX, player.positionZ);
    const transition = environment.consumeChunkTransition();
    if (transition === null) {
      return;
    }
    performance.recordEvent(BattlefieldPerformanceEvent.ChunkTransition);
    performance.recordEvent(BattlefieldPerformanceEvent.ChunksAdded, transition.added.length);
    performance.recordEvent(BattlefieldPerformanceEvent.ChunksRemoved, transition.removed.length);
    chunks.synchronize(transition, environment);
  }
}
