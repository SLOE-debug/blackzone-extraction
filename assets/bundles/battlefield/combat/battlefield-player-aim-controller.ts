import type {
  VanguardControlIntent,
  VanguardPopulation,
} from '../../../player/vanguard';
import { VanguardWeaponPose } from '../../../player/vanguard';
import { VanguardWeaponAction } from '../../../player/vanguard';
import {
  type BattlefieldMonsterPopulation,
  type MutableBattlefieldAimTarget,
} from '../population/battlefield-monster-population';
import { type BattlefieldCameraRig } from '../scene/battlefield-camera';
import { type MutableBattlefieldPlanarDirection } from '../scene/battlefield-camera-direction';
import { type BattlefieldScreenControlState } from '../ui/battlefield-control-hud';
import { shouldFireAtLockedTarget } from './battlefield-fire-intent';

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

/** 把屏幕双摇杆映射为玩家朝向，并协调手动瞄准与自动锁敌。 */
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
   * @returns 本帧是否应持续触发自动射击；有武器、锁定目标并完成转向后才会返回真。
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
    fireTarget: MutableBattlefieldAimTarget,
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

    if (controls.aiming) {
      cameraRig.writeWorldPlanarDirection(
        controls.aimX,
        controls.aimY,
        this.aimDirection,
      );
    } else {
      this.writeAutomaticLockDirection(player.heading);
    }

    const targetFound = controls.aiming
      ? monsters.resolveAimTarget(
        player.positionX,
        player.positionZ,
        this.aimDirection.x,
        this.aimDirection.z,
        this.aimTarget,
      )
      : weaponEquipped && monsters.resolveAutoTarget(
        player.positionX,
        player.positionZ,
        this.aimDirection.x,
        this.aimDirection.z,
        this.aimTarget,
      );
    if (targetFound) {
      this.writeDirectionToTarget(player.positionX, player.positionZ);
    }
    intent.aimX = this.aimDirection.x;
    intent.aimZ = this.aimDirection.z;
    intent.aimPitch = targetFound
      ? this.writePitchToTarget(player.positionX, player.positionY, player.positionZ)
      : 0;
    intent.aiming = controls.aiming || targetFound;
    intent.weaponPose = weaponPose;
    intent.weaponAction = weaponAction;
    intent.weaponActionProgress = weaponActionProgress;
    player.setControlIntent(intent);
    const facingX = Math.sin(player.heading);
    const facingZ = Math.cos(player.heading);
    const firingApproved = weaponEquipped && shouldFireAtLockedTarget(
      targetFound,
      facingX,
      facingZ,
      this.aimDirection.x,
      this.aimDirection.z,
    );
    if (firingApproved) {
      fireTarget.x = this.aimTarget.x;
      fireTarget.y = this.aimTarget.y;
      fireTarget.z = this.aimTarget.z;
    }
    return firingApproved;
  }

  /** 左摇杆有输入时以移动方向锁敌，否则沿玩家当前真实朝向继续搜索。 */
  private writeAutomaticLockDirection(heading: number): void {
    const movementLength = Math.hypot(
      this.movementDirection.x,
      this.movementDirection.z,
    );
    if (movementLength > DIRECTION_EPSILON) {
      const inverseLength = 1 / movementLength;
      this.aimDirection.x = this.movementDirection.x * inverseLength;
      this.aimDirection.z = this.movementDirection.z * inverseLength;
      return;
    }
    this.aimDirection.x = Math.sin(heading);
    this.aimDirection.z = Math.cos(heading);
  }

  private writeDirectionToTarget(originX: number, originZ: number): void {
    const deltaX = this.aimTarget.x - originX;
    const deltaZ = this.aimTarget.z - originZ;
    const inverseDistance = 1 / Math.max(Math.hypot(deltaX, deltaZ), DIRECTION_EPSILON);
    this.aimDirection.x = deltaX * inverseDistance;
    this.aimDirection.z = deltaZ * inverseDistance;
  }

  private writePitchToTarget(originX: number, originY: number, originZ: number): number {
    const planarDistance = Math.hypot(
      this.aimTarget.x - originX,
      this.aimTarget.z - originZ,
    );
    return Math.max(
      -Math.PI * 0.4,
      Math.min(
        Math.PI * 0.4,
        Math.atan2(
          this.aimTarget.y - (originY + PLAYER_WEAPON_AIM_HEIGHT),
          Math.max(planarDistance, DIRECTION_EPSILON),
        ),
      ),
    );
  }
}
