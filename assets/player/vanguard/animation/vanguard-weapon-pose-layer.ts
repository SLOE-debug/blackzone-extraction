import { VanguardBone } from '../model/vanguard-bone';
import { VanguardWeaponAction } from '../model/vanguard-weapon-action';
import { VanguardWeaponPose } from '../model/vanguard-weapon-pose';
import {
  getVanguardWeaponRigProfile,
  VanguardWeaponRigSocket,
  type VanguardWeaponRigProfile,
} from '../model/vanguard-weapon-rig';
import {
  multiplyQuaternions,
  VANGUARD_QUATERNION_COMPONENTS,
  writeYawPitchRollQuaternion,
} from '../rigging/vanguard-pose-math';
import { VANGUARD_LOCAL_POSITION_COMPONENTS } from '../rigging/vanguard-rig';
import { VanguardRecoilSpring } from './vanguard-recoil-spring';

/** 武器约束阶段消费的主握把、前握把和换弹所有权。 */
export interface MutableVanguardWeaponConstraintTargets {
  profile: Readonly<VanguardWeaponRigProfile>;
  mainHandInfluence: number;
  supportHandInfluence: number;
  supportGripOwnership: number;
  supportLocalX: number;
  supportLocalY: number;
  supportLocalZ: number;
}

/** 把武器基础持姿、瞄准、泵动、换弹轨迹和弹簧后坐写入统一 Pose。 */
export class VanguardWeaponPoseLayer {
  private readonly recoil = new VanguardRecoilSpring();
  private readonly additiveRotation = new Float64Array(VANGUARD_QUATERNION_COMPONENTS);
  public readonly constraintTargets: MutableVanguardWeaponConstraintTargets = {
    profile: getVanguardWeaponRigProfile(VanguardWeaponPose.Unarmed),
    mainHandInfluence: 0,
    supportHandInfluence: 0,
    supportGripOwnership: 0,
    supportLocalX: 0,
    supportLocalY: 0,
    supportLocalZ: 0,
  };

  /** 在惯性化之前写入武器基础持姿和连续动作目标。 */
  public writeTargetPose(
    positions: Float64Array,
    rotations: Float64Array,
    weaponPose: VanguardWeaponPose,
    weaponStanceBlend: number,
    locomotionBlend: number,
    aimYaw: number,
    aimPitch: number,
    accelerationRight: number,
    accelerationForward: number,
    action: VanguardWeaponAction,
    actionProgress: number,
    deltaTime: number,
  ): void {
    const profile = getVanguardWeaponRigProfile(weaponPose);
    const stanceBlend = clamp01(weaponStanceBlend);
    const locomotion = clamp01(locomotionBlend);
    const progress = clamp01(actionProgress);
    const reloadEnvelope = action === VanguardWeaponAction.Reload
      ? Math.sin(progress * Math.PI)
      : 0;
    const rootOffset = VanguardBone.WeaponAimRoot * VANGUARD_LOCAL_POSITION_COMPONENTS;
    positions[rootOffset] = lerp(profile.readyRoot.x, profile.runningRoot.x, locomotion)
      - accelerationRight * 0.024 * stanceBlend;
    positions[rootOffset + 1] = lerp(profile.readyRoot.y, profile.runningRoot.y, locomotion)
      - profile.reloadLowering * reloadEnvelope;
    positions[rootOffset + 2] = lerp(profile.readyRoot.z, profile.runningRoot.z, locomotion)
      - profile.reloadTuck * reloadEnvelope
      - accelerationForward * 0.032 * stanceBlend;
    const rootRotationOffset = VanguardBone.WeaponAimRoot
      * VANGUARD_QUATERNION_COMPONENTS;
    writeYawPitchRollQuaternion(
      rotations,
      rootRotationOffset,
      aimYaw * 0.92,
      lerp(profile.readyPitch, profile.runningPitch, locomotion)
        - aimPitch
        - accelerationForward * 0.035 * stanceBlend
        + reloadEnvelope * 0.12,
      profile.runningRoll * locomotion
        - accelerationRight * 0.045 * stanceBlend
        - reloadEnvelope * 0.11,
    );
    if (weaponPose !== VanguardWeaponPose.Unarmed) {
      this.addBoneRotation(
        rotations,
        VanguardBone.Chest,
        0,
        (weaponPose === VanguardWeaponPose.Shotgun ? 0.055 : 0.032) * stanceBlend,
        (weaponPose === VanguardWeaponPose.Shotgun ? -0.018 : -0.01) * stanceBlend,
      );
    }
    this.recoil.update(profile, action, progress, deltaTime);
    this.writeConstraintTargets(profile, action, progress, stanceBlend);
  }

  /** 在局部惯性化之后叠加独立二阶弹簧，确保开火冲击不会被普通混合吞掉。 */
  public applyRecoilAdditive(
    positions: Float32Array,
    rotations: Float32Array,
  ): void {
    const rootPositionOffset = VanguardBone.WeaponAimRoot
      * VANGUARD_LOCAL_POSITION_COMPONENTS;
    positions[rootPositionOffset + 2] = (positions[rootPositionOffset + 2] ?? 0)
      - this.recoil.backOffset;
    this.addBoneRotation(
      rotations,
      VanguardBone.WeaponAimRoot,
      0,
      -this.recoil.pitchOffset,
      0,
    );
    this.addBoneRotation(
      rotations,
      VanguardBone.Chest,
      0,
      -this.recoil.pitchOffset * 0.16,
      0,
    );
    this.addBoneRotation(
      rotations,
      VanguardBone.VisualRoot,
      0,
      -this.recoil.pitchOffset * 0.035,
      0,
    );
  }

  private writeConstraintTargets(
    profile: Readonly<VanguardWeaponRigProfile>,
    action: VanguardWeaponAction,
    progress: number,
    stanceBlend: number,
  ): void {
    const targets = this.constraintTargets;
    targets.profile = profile;
    targets.mainHandInfluence = profile.mainHandInfluence * stanceBlend;
    targets.supportHandInfluence = profile.supportHandInfluence * stanceBlend;
    targets.supportGripOwnership = profile.supportHandInfluence > 0 ? 1 : 0;
    const supportGrip = profile.sockets[VanguardWeaponRigSocket.SupportGrip];
    targets.supportLocalX = supportGrip.x;
    targets.supportLocalY = supportGrip.y;
    targets.supportLocalZ = supportGrip.z;
    if (action === VanguardWeaponAction.Fire && profile.pumpTravel > 0) {
      const pumpAmount = samplePumpAmount(progress);
      const pumpHandle = profile.sockets[VanguardWeaponRigSocket.PumpHandle];
      targets.supportLocalX = pumpHandle.x;
      targets.supportLocalY = pumpHandle.y;
      targets.supportLocalZ = pumpHandle.z - profile.pumpTravel * pumpAmount;
      return;
    }
    if (action !== VanguardWeaponAction.Reload || profile.supportHandInfluence <= 0) {
      return;
    }
    const magazine = profile.sockets[VanguardWeaponRigSocket.Magazine];
    const ownership = sampleReloadGripOwnership(progress);
    const reach = sampleReloadReach(progress);
    targets.supportGripOwnership = ownership;
    targets.supportLocalX = lerp(supportGrip.x, magazine.x, reach);
    targets.supportLocalY = lerp(supportGrip.y, magazine.y, reach)
      - Math.sin(reach * Math.PI) * 0.08;
    targets.supportLocalZ = lerp(supportGrip.z, magazine.z, reach)
      - Math.sin(reach * Math.PI) * 0.06;
  }

  private addBoneRotation(
    rotations: Float32Array | Float64Array,
    bone: VanguardBone,
    yaw: number,
    pitch: number,
    roll: number,
  ): void {
    const offset = bone * VANGUARD_QUATERNION_COMPONENTS;
    writeYawPitchRollQuaternion(this.additiveRotation, 0, yaw, pitch, roll);
    multiplyQuaternions(
      rotations,
      offset,
      rotations,
      offset,
      this.additiveRotation,
      0,
    );
  }
}

function samplePumpAmount(progress: number): number {
  if (progress <= 0.18) {
    return 0;
  }
  if (progress <= 0.46) {
    return smoothStep((progress - 0.18) / 0.28);
  }
  if (progress <= 0.76) {
    return 1 - smoothStep((progress - 0.46) / 0.3);
  }
  return 0;
}

function sampleReloadGripOwnership(progress: number): number {
  if (progress <= 0.18) {
    return 1 - smoothStep(progress / 0.18);
  }
  if (progress < 0.72) {
    return 0;
  }
  return smoothStep((progress - 0.72) / 0.28);
}

function sampleReloadReach(progress: number): number {
  if (progress <= 0.18) {
    return smoothStep(progress / 0.18) * 0.22;
  }
  if (progress <= 0.44) {
    return lerp(0.22, 1, smoothStep((progress - 0.18) / 0.26));
  }
  if (progress <= 0.72) {
    return 1;
  }
  return 1 - smoothStep((progress - 0.72) / 0.28);
}

function smoothStep(value: number): number {
  const clamped = clamp01(value);
  return clamped * clamped * (3 - clamped * 2);
}

function lerp(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
