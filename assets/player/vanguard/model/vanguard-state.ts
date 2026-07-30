import { EntityTable } from '../../../core/entities/entity-table';
import { VANGUARD_CONFIG } from './vanguard-config';
import { VANGUARD_MAX_HEALTH, VanguardLifePhase } from './vanguard-life';
import {
  type VanguardPopulationOptions,
  validateVanguardOptions,
} from './vanguard-options';
import {
  VANGUARD_SCHEMA,
  type VanguardData,
  type VanguardTable,
} from './vanguard-schema';
import { writeVanguardMantleRestState } from './vanguard-mantle-state';
import { VanguardWeaponPose } from './vanguard-weapon-pose';
import { VanguardWeaponAction } from './vanguard-weapon-action';
import { VanguardFacingPolicy } from './vanguard-facing-policy';

/** 聚合可复用主角的单实体 SoA 状态。 */
export class VanguardState {
  public readonly table: VanguardTable;
  public readonly data: VanguardData;

  constructor(options: Readonly<VanguardPopulationOptions>) {
    validateVanguardOptions(options);
    this.table = new EntityTable(VANGUARD_SCHEMA, 1);
    this.table.allocate();
    this.data = this.table.data;
    initializeVanguardData(this.data, options);
  }

  /** 当前活动主角实体数量。 */
  public get count(): number {
    return this.table.count;
  }
}

/** 写入调用场景提供的初始位置、动作和稳定形态。 */
function initializeVanguardData(
  data: VanguardData,
  options: Readonly<VanguardPopulationOptions>,
): void {
  const {
    transform,
    morphology,
    intent,
    motion,
    vitality,
    animation,
    gait,
    weaponAnimation,
    mantle,
  } = data;
  transform.x[0] = options.position.x;
  transform.y[0] = options.position.y;
  transform.z[0] = options.position.z;
  transform.heading[0] = options.heading;

  morphology.scale[0] = VANGUARD_CONFIG.scale;

  intent.action[0] = options.action;
  intent.moveX[0] = 0;
  intent.moveZ[0] = 0;
  intent.attackX[0] = 0;
  intent.attackZ[0] = 1;
  intent.attacking[0] = 0;
  intent.weaponPose[0] = VanguardWeaponPose.Unarmed;
  intent.weaponAction[0] = VanguardWeaponAction.Idle;
  intent.weaponActionProgress[0] = 0;
  intent.weaponActionSide[0] = 0;
  intent.facingPolicy[0] = VanguardFacingPolicy.Free;
  intent.desiredHeading[0] = options.heading;
  intent.maximumTurnSpeed[0] = 0;
  motion.velocityX[0] = 0;
  motion.velocityZ[0] = 0;
  motion.speed[0] = 0;
  motion.locomotionForward[0] = 0;
  motion.locomotionRight[0] = 0;
  vitality.health[0] = VANGUARD_MAX_HEALTH;
  vitality.phase[0] = VanguardLifePhase.Alive;
  vitality.hitTime[0] = 0;
  animation.idlePhase[0] = 0;
  animation.locomotionPhase[0] = 0;
  animation.locomotionBlend[0] = 0;
  animation.weaponPose[0] = VanguardWeaponPose.Unarmed;
  animation.weaponStanceBlend[0] = 0;
  animation.hitFlash[0] = 0;
  gait.initialized[0] = 0;
  gait.leftPhase[0] = 0;
  gait.rightPhase[0] = 0;
  gait.leftAnchorX[0] = options.position.x;
  gait.leftAnchorZ[0] = options.position.z;
  gait.rightAnchorX[0] = options.position.x;
  gait.rightAnchorZ[0] = options.position.z;
  gait.leftSwingStartX[0] = options.position.x;
  gait.leftSwingStartZ[0] = options.position.z;
  gait.rightSwingStartX[0] = options.position.x;
  gait.rightSwingStartZ[0] = options.position.z;
  gait.leftLandingX[0] = options.position.x;
  gait.leftLandingZ[0] = options.position.z;
  gait.rightLandingX[0] = options.position.x;
  gait.rightLandingZ[0] = options.position.z;
  gait.pelvisShiftX[0] = 0;
  gait.pelvisShiftXVelocity[0] = 0;
  gait.pelvisShiftZ[0] = 0;
  gait.pelvisShiftZVelocity[0] = 0;
  gait.leanForward[0] = 0;
  gait.leanForwardVelocity[0] = 0;
  gait.leanRight[0] = 0;
  gait.leanRightVelocity[0] = 0;
  gait.previousVelocityX[0] = 0;
  gait.previousVelocityZ[0] = 0;
  gait.previousHeading[0] = options.heading;
  weaponAnimation.chestYaw[0] = 0;
  weaponAnimation.chestYawVelocity[0] = 0;
  weaponAnimation.pelvisYaw[0] = 0;
  weaponAnimation.pelvisYawVelocity[0] = 0;
  weaponAnimation.leftElbowPoleX[0] = -1.34;
  weaponAnimation.leftElbowPoleY[0] = 2.3;
  weaponAnimation.leftElbowPoleZ[0] = 0.82;
  weaponAnimation.rightElbowPoleX[0] = 1.34;
  weaponAnimation.rightElbowPoleY[0] = 2.3;
  weaponAnimation.rightElbowPoleZ[0] = 0.82;
  weaponAnimation.mainGripWeight[0] = 0;
  weaponAnimation.supportGripWeight[0] = 0;
  weaponAnimation.hammerLag[0] = 0;
  weaponAnimation.hammerLagVelocity[0] = 0;
  writeVanguardMantleRestState(
    mantle,
    0,
    transform.x[0] ?? 0,
    transform.y[0] ?? 0,
    transform.z[0] ?? 0,
    transform.heading[0] ?? 0,
    morphology.scale[0] ?? 1,
  );
  mantle.initialized[0] = 0;
}
