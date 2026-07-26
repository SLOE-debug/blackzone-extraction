import { WorldPhase } from '../../../../core/world/world-phase';
import { type MutableVanguardWeaponRigPose } from '../../../../player/vanguard/model/vanguard-weapon-rig-pose';
import { BattlefieldPerformanceStage } from '../../debug/battlefield-performance-contracts';
import { type BattlefieldWorld } from '../battlefield-world';
import { BattlefieldWorldSystem } from './battlefield-world-system';

/** 在角色动画刷新后把右手权威挂点提交给大锤渲染器。 */
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
  };

  protected execute(world: BattlefieldWorld, deltaTime: number): void {
    const { player, weapon } = world.resources;
    player.writeWeaponRigPose(this.pose);
    weapon.synchronizeHeldPose(deltaTime, this.pose);
  }
}
