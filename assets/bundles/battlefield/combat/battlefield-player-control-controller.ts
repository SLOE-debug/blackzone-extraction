import { type VanguardControlIntent } from '../../../player/vanguard/model/vanguard-control-intent';
import { VanguardWeaponAction } from '../../../player/vanguard/model/vanguard-weapon-action';
import { VanguardWeaponPose } from '../../../player/vanguard/model/vanguard-weapon-pose';
import { type VanguardPopulation } from '../../../player/vanguard/population/vanguard-population';
import { type VanguardFacingPolicy } from '../../../player/vanguard/model/vanguard-facing-policy';
import { type BattlefieldHammerActionControlEffect } from '../equipment/combat/battlefield-facing-lock-effect';
import { SLEDGEHAMMER_PROGRESSION } from '../equipment/items/sledgehammer/sledgehammer-progression';
import { type BattlefieldCameraRig } from '../scene/battlefield-camera';
import { type MutableBattlefieldPlanarDirection } from '../scene/battlefield-camera-direction';
import { type BattlefieldScreenControlState } from '../ui/battlefield-control-hud';

interface MutableVanguardControlIntent extends VanguardControlIntent {
  moveX: number;
  moveZ: number;
  attackX: number;
  attackZ: number;
  attacking: boolean;
  facingPolicy: VanguardFacingPolicy;
  desiredHeading: number;
  maximumTurnSpeed: number;
  weaponPose: VanguardWeaponPose;
  weaponAction: VanguardWeaponAction;
  weaponActionProgress: number;
  weaponActionSide: -1 | 0 | 1;
}

/** 把左摇杆映射为移动，并在武器动作期间应用权威朝向锁定。 */
export class BattlefieldPlayerControlController {
  private readonly movementDirection: MutableBattlefieldPlanarDirection = { x: 0, z: 0 };
  private readonly intent: MutableVanguardControlIntent = {
    moveX: 0,
    moveZ: 0,
    attackX: 0,
    attackZ: 1,
    attacking: false,
    facingPolicy: 0,
    desiredHeading: 0,
    maximumTurnSpeed: 0,
    weaponPose: VanguardWeaponPose.Unarmed,
    weaponAction: VanguardWeaponAction.Idle,
    weaponActionProgress: 0,
    weaponActionSide: 0,
  };

  /** 写入玩家本帧完整控制意图。 */
  public apply(
    player: VanguardPopulation,
    cameraRig: BattlefieldCameraRig,
    controls: Readonly<BattlefieldScreenControlState>,
    weaponPose: VanguardWeaponPose,
    weaponAction: VanguardWeaponAction,
    weaponActionProgress: number,
    weaponActionSide: -1 | 0 | 1,
    movementSpeedMultiplier: number,
    actionControl: Readonly<BattlefieldHammerActionControlEffect>,
  ): void {
    if (![movementSpeedMultiplier, actionControl.movementScale].every(Number.isFinite)
      || movementSpeedMultiplier <= 0 || movementSpeedMultiplier > 1
      || actionControl.movementScale <= 0 || actionControl.movementScale > 1) {
      throw new Error('玩家移动乘数必须位于零到一之间。');
    }
    cameraRig.queueOrbitRotation(controls.cameraOrbitDeltaX);
    cameraRig.writeWorldPlanarDirection(
      controls.moveX,
      controls.moveY,
      this.movementDirection,
    );
    const intent = this.intent;
    const speedScale = movementSpeedMultiplier * actionControl.movementScale;
    intent.moveX = this.movementDirection.x * speedScale;
    intent.moveZ = this.movementDirection.z * speedScale;
    intent.weaponPose = weaponPose;
    intent.weaponAction = weaponAction;
    intent.weaponActionProgress = weaponActionProgress;
    intent.weaponActionSide = weaponActionSide;
    intent.facingPolicy = actionControl.facingPolicy;
    intent.desiredHeading = actionControl.desiredHeading;
    intent.maximumTurnSpeed = actionControl.maximumTurnSpeed;
    intent.attackX = 0;
    intent.attackZ = 1;
    intent.attacking = false;
    if (weaponAction === VanguardWeaponAction.GroundSlam) {
      const stepProgress = Math.max(0, Math.min(
        1,
        (weaponActionProgress - SLEDGEHAMMER_PROGRESSION.groundSlamStepStartProgress)
          / SLEDGEHAMMER_PROGRESSION.groundSlamStepDurationProgress,
      ));
      const stepSpeed = Math.sin(stepProgress * Math.PI)
        * SLEDGEHAMMER_PROGRESSION.groundSlamStepInputScale;
      intent.moveX = Math.sin(player.heading) * stepSpeed;
      intent.moveZ = Math.cos(player.heading) * stepSpeed;
    }
    player.setControlIntent(intent);
  }
}
