import { WorldPhase } from '../../../../core/world/world-phase';
import {
  BattlefieldPerformanceEvent,
  BattlefieldPerformanceStage,
} from '../../debug/battlefield-performance-contracts';
import { type BattlefieldWorld } from '../battlefield-world';
import { type MutableBattlefieldWeaponMuzzlePose } from '../../equipment/combat/battlefield-weapon-muzzle-pose';
import { BattlefieldWorldSystem } from './battlefield-world-system';

/** 在玩家姿态更新后同步武器并生成本帧需要参与积分的新弹丸。 */
export class BattlefieldWeaponWorldSystem extends BattlefieldWorldSystem {
  public readonly phase = WorldPhase.PreSimulation;
  public readonly order = 10;
  protected readonly performanceStage = BattlefieldPerformanceStage.Weapon;
  private readonly muzzlePose: MutableBattlefieldWeaponMuzzlePose = {
    muzzleX: 0,
    muzzleY: 0,
    muzzleZ: 0,
  };
  protected execute(world: BattlefieldWorld, deltaTime: number): void {
    const { player, weapon, monsters, performance } = world.resources;
    weapon.beginProjectileFrame();
    const pose = world.weaponOwnerPose;
    player.writeWeaponRigPose(pose);
    pose.alive = player.isAlive;
    const fireDirection = world.weaponFireDirection;
    let fireIntent: Readonly<typeof world.weaponFireIntent> | null = null;
    let firingMuzzle: Readonly<MutableBattlefieldWeaponMuzzlePose> | null = null;
    if (world.weaponFiringRequested && weapon.writeMuzzlePose(pose, this.muzzlePose)) {
      const maximumRange = weapon.projectileMaximumRange;
      if (maximumRange === null) {
        throw new Error('已装备武器缺少实体弹丸射程。');
      }
      const resolvedIntent = world.weaponFireIntent;
      if (monsters.resolveElevationAlongSegment(
        this.muzzlePose.muzzleX,
        this.muzzlePose.muzzleZ,
        fireDirection.directionX,
        fireDirection.directionZ,
        maximumRange,
        resolvedIntent.elevationTarget,
      )) {
        resolvedIntent.directionX = fireDirection.directionX;
        resolvedIntent.directionZ = fireDirection.directionZ;
        fireIntent = resolvedIntent;
        firingMuzzle = this.muzzlePose;
      }
    }
    weapon.updateFiring(
      deltaTime,
      pose,
      fireIntent,
      firingMuzzle,
    );
    performance.recordEvent(
      BattlefieldPerformanceEvent.ProjectilesSpawned,
      weapon.projectileStatistics.projectilesSpawned,
    );
  }
}
