import { type VanguardControlIntent } from '../../../player/vanguard/model/vanguard-control-intent';
import { VanguardWeaponAction } from '../../../player/vanguard/model/vanguard-weapon-action';
import { VanguardWeaponPose } from '../../../player/vanguard/model/vanguard-weapon-pose';
import { type VanguardPopulation } from '../../../player/vanguard/population/vanguard-population';
import {
  type BattlefieldMonsterPopulation,
  type MutableBattlefieldAimTarget,
} from '../population/battlefield-monster-population';
import { type BattlefieldCameraRig } from '../scene/battlefield-camera';
import { type MutableBattlefieldPlanarDirection } from '../scene/battlefield-camera-direction';
import { type BattlefieldScreenControlState } from '../ui/battlefield-control-hud';
import { type MutableBattlefieldFireIntent } from './battlefield-fire-intent';

const DIRECTION_EPSILON = 0.0001;
const PLAYER_WEAPON_AIM_HEIGHT = 2.35;

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
  private readonly aimTarget: MutableBattlefieldAimTarget = { x: 0, y: 0, z: 0 };
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
    monsters: BattlefieldMonsterPopulation,
    cameraRig: BattlefieldCameraRig,
    controls: Readonly<BattlefieldScreenControlState>,
    weaponPose: VanguardWeaponPose,
    weaponAction: VanguardWeaponAction,
    weaponActionProgress: number,
    movementSpeedMultiplier: number,
    fireIntent: MutableBattlefieldFireIntent,
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
    const targetFound = monsters.resolveAimTarget(
      player.positionX,
      player.positionZ,
      this.aimDirection.x,
      this.aimDirection.z,
      this.aimTarget,
    );
    fireIntent.directionX = this.aimDirection.x;
    fireIntent.directionZ = this.aimDirection.z;
    if (targetFound) {
      const targetDeltaX = this.aimTarget.x - player.positionX;
      const targetDeltaZ = this.aimTarget.z - player.positionZ;
      const projectedDistance = targetDeltaX * this.aimDirection.x
        + targetDeltaZ * this.aimDirection.z;
      fireIntent.targetElevation = this.aimTarget.y;
      fireIntent.targetDistance = Math.max(projectedDistance, DIRECTION_EPSILON);
      intent.aimPitch = this.writePitchToTarget(
        player.positionY,
        fireIntent.targetDistance,
      );
    } else {
      fireIntent.targetElevation = null;
      fireIntent.targetDistance = null;
      intent.aimPitch = 0;
    }
    intent.aimX = this.aimDirection.x;
    intent.aimZ = this.aimDirection.z;
    intent.aiming = true;
    player.setControlIntent(intent);
    return true;
  }

  /** 只按候选高度和手动方向上的投影距离计算展示俯仰。 */
  private writePitchToTarget(originY: number, projectedDistance: number): number {
    return Math.max(
      -Math.PI * 0.4,
      Math.min(
        Math.PI * 0.4,
        Math.atan2(
          this.aimTarget.y - (originY + PLAYER_WEAPON_AIM_HEIGHT),
          Math.max(projectedDistance, DIRECTION_EPSILON),
        ),
      ),
    );
  }
}
