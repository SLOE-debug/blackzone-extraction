import { WorldPhase } from '../../../../core/world/world-phase';
import {
  BattlefieldPerformanceEvent,
  BattlefieldPerformanceStage,
} from '../../debug/battlefield-performance-contracts';
import { type BattlefieldWorld } from '../battlefield-world';
import { BattlefieldWorldSystem } from './battlefield-world-system';

/** 在最新怪物空间索引上执行实体弹丸 CCD 与穿透。 */
export class BattlefieldProjectileCollisionWorldSystem extends BattlefieldWorldSystem {
  public readonly phase = WorldPhase.Combat;
  public readonly order = 0;
  protected readonly performanceStage = BattlefieldPerformanceStage.Weapon;

  protected execute(world: BattlefieldWorld): void {
    const { weapon, monsters, performance } = world.resources;
    weapon.collideProjectiles(monsters);
    const statistics = weapon.projectileStatistics;
    performance.recordEvent(
      BattlefieldPerformanceEvent.ProjectileBroadPhaseCandidates,
      statistics.broadPhaseCandidates,
    );
    performance.recordEvent(
      BattlefieldPerformanceEvent.ProjectileNarrowPhaseHits,
      statistics.narrowPhaseHits,
    );
    performance.recordEvent(
      BattlefieldPerformanceEvent.ProjectileImpactsQueued,
      statistics.impactsQueued,
    );
  }
}
