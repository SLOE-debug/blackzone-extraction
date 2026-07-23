import { WorldPhase } from '../../../../core/world/world-phase';
import {
  BattlefieldPerformanceEvent,
  BattlefieldPerformanceStage,
} from '../../debug/battlefield-performance-contracts';
import { type BattlefieldWorld } from '../battlefield-world';
import { BattlefieldWorldSystem } from './battlefield-world-system';

/** 在玩家姿态更新后同步武器并生成本帧需要参与积分的新弹丸。 */
export class BattlefieldWeaponWorldSystem extends BattlefieldWorldSystem {
  public readonly phase = WorldPhase.PreSimulation;
  public readonly order = 10;
  protected readonly performanceStage = BattlefieldPerformanceStage.Weapon;

  protected execute(world: BattlefieldWorld, deltaTime: number): void {
    const { player, weapon, performance } = world.resources;
    weapon.beginProjectileFrame();
    const pose = world.weaponOwnerPose;
    player.writeWeaponRigPose(pose);
    pose.alive = player.isAlive;
    weapon.updateFiring(
      deltaTime,
      pose,
      world.weaponFiringRequested ? world.weaponFireIntent : null,
    );
    performance.recordEvent(
      BattlefieldPerformanceEvent.ProjectilesSpawned,
      weapon.projectileStatistics.projectilesSpawned,
    );
  }
}
