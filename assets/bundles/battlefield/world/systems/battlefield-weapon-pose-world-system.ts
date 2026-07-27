import { WorldPhase } from '../../../../core/world/world-phase';
import { type MutableVanguardWeaponRigPose } from '../../../../player/vanguard/model/vanguard-weapon-rig-pose';
import { BattlefieldPerformanceStage } from '../../debug/battlefield-performance-contracts';
import { type BattlefieldWorld } from '../battlefield-world';
import { BattlefieldWorldSystem } from './battlefield-world-system';

/** 在角色动画刷新后把双手握点和唯一 WeaponRoot 提交给装备渲染器。 */
export class BattlefieldWeaponPoseWorldSystem extends BattlefieldWorldSystem {
  public readonly phase = WorldPhase.PreSimulation;
  public readonly order = 20;
  protected readonly performanceStage = BattlefieldPerformanceStage.Weapon;
  private readonly pose: MutableVanguardWeaponRigPose = {
    rootX: 0,
    rootY: 0,
    rootZ: 0,
    rotationX: 0,
    rotationY: 0,
    rotationZ: 0,
    rotationW: 1,
    forwardX: 0,
    forwardY: 0,
    forwardZ: 1,
    mainGripX: 0,
    mainGripY: 0,
    mainGripZ: 0,
    supportGripX: 0,
    supportGripY: 0,
    supportGripZ: 0,
  };

  protected execute(world: BattlefieldWorld): void {
    const { player, weapon } = world.resources;
    player.writeWeaponRigPose(this.pose);
    weapon.synchronizeHeldPose(this.pose);
  }
}
