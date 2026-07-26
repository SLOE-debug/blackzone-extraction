import { type VanguardControlIntent } from '../../../player/vanguard/model/vanguard-control-intent';
import { VanguardWeaponAction } from '../../../player/vanguard/model/vanguard-weapon-action';
import { VanguardWeaponPose } from '../../../player/vanguard/model/vanguard-weapon-pose';
import { type VanguardPopulation } from '../../../player/vanguard/population/vanguard-population';
import { type BattlefieldFacingLockEffect } from '../equipment/combat/battlefield-facing-lock-effect';
import { type BattlefieldCameraRig } from '../scene/battlefield-camera';
import { type MutableBattlefieldPlanarDirection } from '../scene/battlefield-camera-direction';
import { type BattlefieldScreenControlState } from '../ui/battlefield-control-hud';

interface MutableVanguardControlIntent extends VanguardControlIntent {
  moveX: number;
  moveZ: number;
  attackX: number;
  attackZ: number;
  attacking: boolean;
  facingLocked: boolean;
  lockedHeading: number;
  weaponPose: VanguardWeaponPose;
  weaponAction: VanguardWeaponAction;
  weaponActionProgress: number;
}

/** 把左摇杆映射为移动、右摇杆映射为攻击朝向，并在移动前应用朝向锁定。 */
export class BattlefieldPlayerControlController {
  private readonly movementDirection: MutableBattlefieldPlanarDirection = { x: 0, z: 0 };
  private readonly attackDirection: MutableBattlefieldPlanarDirection = { x: 0, z: 1 };
  private readonly intent: MutableVanguardControlIntent = {
    moveX: 0,
    moveZ: 0,
    attackX: 0,
    attackZ: 1,
    attacking: false,
    facingLocked: false,
    lockedHeading: 0,
    weaponPose: VanguardWeaponPose.Unarmed,
    weaponAction: VanguardWeaponAction.Idle,
    weaponActionProgress: 0,
  };

  /** 写入玩家本帧完整控制意图。 */
  public apply(
    player: VanguardPopulation,
    cameraRig: BattlefieldCameraRig,
    controls: Readonly<BattlefieldScreenControlState>,
    weaponPose: VanguardWeaponPose,
    weaponAction: VanguardWeaponAction,
    weaponActionProgress: number,
    movementSpeedMultiplier: number,
    weaponMovementScale: number,
    facingLock: Readonly<BattlefieldFacingLockEffect> | null,
  ): void {
    if (![movementSpeedMultiplier, weaponMovementScale].every(Number.isFinite)
      || movementSpeedMultiplier <= 0 || movementSpeedMultiplier > 1
      || weaponMovementScale <= 0 || weaponMovementScale > 1) {
      throw new Error('玩家移动乘数必须位于零到一之间。');
    }
    cameraRig.queueOrbitRotation(controls.cameraOrbitDeltaX);
    cameraRig.writeWorldPlanarDirection(
      controls.moveX,
      controls.moveY,
      this.movementDirection,
    );
    const intent = this.intent;
    const speedScale = movementSpeedMultiplier * weaponMovementScale;
    intent.moveX = this.movementDirection.x * speedScale;
    intent.moveZ = this.movementDirection.z * speedScale;
    intent.weaponPose = weaponPose;
    intent.weaponAction = weaponAction;
    intent.weaponActionProgress = weaponActionProgress;
    intent.facingLocked = facingLock !== null;
    intent.lockedHeading = facingLock?.lockedHeading ?? player.heading;
    if (controls.attacking) {
      cameraRig.writeWorldPlanarDirection(
        controls.attackX,
        controls.attackY,
        this.attackDirection,
      );
      intent.attackX = this.attackDirection.x;
      intent.attackZ = this.attackDirection.z;
      intent.attacking = true;
    } else {
      intent.attacking = false;
    }
    player.setControlIntent(intent);
  }
}
