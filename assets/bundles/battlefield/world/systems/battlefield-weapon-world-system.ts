import { WorldPhase } from '../../../../core/world/world-phase';
import { BattlefieldPerformanceStage } from '../../debug/battlefield-performance-contracts';
import { type BattlefieldWorld } from '../battlefield-world';
import { BattlefieldWorldSystem } from './battlefield-world-system';

/** 在 Combat 阶段同步玩家武器姿态并只生成新弹丸。 */
export class BattlefieldWeaponWorldSystem extends BattlefieldWorldSystem {
  public readonly phase = WorldPhase.Combat;
  public readonly order = 10;
  protected readonly performanceStage = BattlefieldPerformanceStage.Weapon;

  protected execute(world: BattlefieldWorld, deltaTime: number): void {
    const { player, weapon } = world.resources;
    const pose = world.weaponOwnerPose;
    player.writeWeaponRigPose(pose);
    pose.alive = player.isAlive;
    weapon.updateFiring(
      deltaTime,
      pose,
      world.weaponFiringRequested ? world.weaponAimTarget : null,
    );
  }
}
