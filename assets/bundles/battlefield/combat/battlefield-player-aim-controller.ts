import { type VanguardControlIntent } from '../../../player/vanguard/model/vanguard-control-intent';
import { VanguardWeaponAction } from '../../../player/vanguard/model/vanguard-weapon-action';
import { VanguardWeaponPose } from '../../../player/vanguard/model/vanguard-weapon-pose';
import { type VanguardPopulation } from '../../../player/vanguard/population/vanguard-population';
import { type BattlefieldCameraRig } from '../scene/battlefield-camera';
import { type MutableBattlefieldPlanarDirection } from '../scene/battlefield-camera-direction';
import { type BattlefieldScreenControlState } from '../ui/battlefield-control-hud';
import { type MutableBattlefieldFireDirection } from './battlefield-fire-intent';

interface MutableVanguardControlIntent extends VanguardControlIntent {
  moveX: number;
  moveZ: number;
  aimX: number;
  aimZ: number;
  aimPitch: number;
  aiming: boolean;
  weaponPose: VanguardWeaponPose;
  weaponAction: VanguardWeaponAction;
  weaponActionProgress: number;
}

/** 把左摇杆映射为移动，并把右摇杆独立映射为瞄准和持续射击。 */
export class BattlefieldPlayerAimController {
  private readonly movementDirection: MutableBattlefieldPlanarDirection = { x: 0, z: 0 };
  private readonly aimDirection: MutableBattlefieldPlanarDirection = { x: 0, z: 1 };
  private readonly intent: MutableVanguardControlIntent = {
    moveX: 0,
    moveZ: 0,
    aimX: 0,
    aimZ: 1,
    aimPitch: 0,
    aiming: false,
    weaponPose: VanguardWeaponPose.Unarmed,
    weaponAction: VanguardWeaponAction.Ready,
    weaponActionProgress: 0,
  };

  /**
   * 写入玩家控制意图。
   *
   * @returns 本帧右摇杆是否请求持续射击；不要求必须存在辅助目标。
   */
  public apply(
    player: VanguardPopulation,
    cameraRig: BattlefieldCameraRig,
    controls: Readonly<BattlefieldScreenControlState>,
    weaponPose: VanguardWeaponPose,
    weaponAction: VanguardWeaponAction,
    weaponActionProgress: number,
    movementSpeedMultiplier: number,
    fireDirection: MutableBattlefieldFireDirection,
  ): boolean {
    if (!Number.isFinite(movementSpeedMultiplier)
      || movementSpeedMultiplier <= 0
      || movementSpeedMultiplier > 1) {
      throw new Error('玩家怪物效果移动乘数必须位于零到一之间。');
    }
    const weaponEquipped = weaponPose !== VanguardWeaponPose.Unarmed;
    cameraRig.queueOrbitRotation(controls.cameraOrbitDeltaX);
    cameraRig.writeWorldPlanarDirection(
      controls.moveX,
      controls.moveY,
      this.movementDirection,
    );
    const intent = this.intent;
    intent.moveX = this.movementDirection.x * movementSpeedMultiplier;
    intent.moveZ = this.movementDirection.z * movementSpeedMultiplier;

    intent.weaponPose = weaponPose;
    intent.weaponAction = weaponAction;
    intent.weaponActionProgress = weaponActionProgress;
    if (!controls.aiming || !weaponEquipped) {
      intent.aiming = false;
      intent.aimPitch = 0;
      player.setControlIntent(intent);
      return false;
    }

    cameraRig.writeWorldPlanarDirection(
      controls.aimX,
      controls.aimY,
      this.aimDirection,
    );
    fireDirection.directionX = this.aimDirection.x;
    fireDirection.directionZ = this.aimDirection.z;
    intent.aimPitch = 0;
    intent.aimX = this.aimDirection.x;
    intent.aimZ = this.aimDirection.z;
    intent.aiming = true;
    player.setControlIntent(intent);
    return true;
  }
}
