import { VanguardWeaponAction } from '../model/vanguard-weapon-action';
import { type VanguardWeaponRigProfile } from '../model/vanguard-weapon-rig';

const MAXIMUM_STEP = 1 / 120;

/** 由开火冲量驱动的武器后坐二阶弹簧。 */
export class VanguardRecoilSpring {
  private pitchOffsetValue = 0;
  private pitchVelocity = 0;
  private backOffsetValue = 0;
  private backVelocity = 0;
  private previousAction = VanguardWeaponAction.Ready;
  private previousProgress = 0;

  public get pitchOffset(): number {
    return this.pitchOffsetValue;
  }

  public get backOffset(): number {
    return this.backOffsetValue;
  }

  /** 检测一次新的开火脉冲并推进稳定弹簧。 */
  public update(
    profile: Readonly<VanguardWeaponRigProfile>,
    action: VanguardWeaponAction,
    actionProgress: number,
    deltaTime: number,
  ): void {
    const progress = clamp01(actionProgress);
    const newShot = action === VanguardWeaponAction.Fire
      && (this.previousAction !== VanguardWeaponAction.Fire
        || progress + 0.08 < this.previousProgress);
    if (newShot) {
      this.pitchVelocity += profile.recoilPitchImpulse;
      this.backVelocity += profile.recoilBackImpulse;
    }
    this.previousAction = action;
    this.previousProgress = progress;
    const safeDeltaTime = Math.max(0, Math.min(deltaTime, 0.05));
    const stepCount = Math.max(1, Math.ceil(safeDeltaTime / MAXIMUM_STEP));
    const step = safeDeltaTime / stepCount;
    for (let iteration = 0; iteration < stepCount; iteration++) {
      this.pitchVelocity += (
        -profile.recoilStiffness * this.pitchOffsetValue
          - profile.recoilDamping * this.pitchVelocity
      ) * step;
      this.pitchOffsetValue += this.pitchVelocity * step;
      this.backVelocity += (
        -profile.recoilStiffness * this.backOffsetValue
          - profile.recoilDamping * this.backVelocity
      ) * step;
      this.backOffsetValue += this.backVelocity * step;
    }
    if (profile.recoilStiffness <= 0) {
      this.pitchOffsetValue = 0;
      this.pitchVelocity = 0;
      this.backOffsetValue = 0;
      this.backVelocity = 0;
    }
  }
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
