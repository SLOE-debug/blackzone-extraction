import { updateSecondOrderResponse } from '../../../core/math/second-order-response';
import { TAU } from '../../../core/math/scalar';
import { VANGUARD_ANATOMY } from '../model/vanguard-anatomy';
import { VANGUARD_CONFIG } from '../model/vanguard-config';
import { type VanguardData } from '../model/vanguard-schema';
import { VanguardGaitPhase } from '../model/vanguard-gait-phase';
import { VanguardWeaponAction } from '../model/vanguard-weapon-action';

const STANCE_END = 0.5;
const TOE_OFF_END = 0.58;
const SWING_END = 0.9;
const FOOT_HALF_WIDTH = 0.36;
const MINIMUM_FOOT_LANE_OFFSET = 0.18;
const HALF_CYCLE_TRAVEL_DISTANCE = 0.5 / VANGUARD_CONFIG.locomotionCyclesPerMeter;
const LANDING_LOOKAHEAD_DISTANCE = HALF_CYCLE_TRAVEL_DISTANCE * 1.5;
const MOVING_BLEND_THRESHOLD = 0.04;
const LEG_REACH_SAFETY_MARGIN = 0.02;
const MAXIMUM_GAIT_PELVIS_DROP = 0.26;

/** 姿态求解器单帧读取的连续脚底、骨盆和躯干状态。 */
export interface VanguardGaitPoseState {
  leftAnkleX: number;
  leftAnkleY: number;
  leftAnkleZ: number;
  rightAnkleX: number;
  rightAnkleY: number;
  rightAnkleZ: number;
  bodyBob: number;
  pelvisShiftX: number;
  pelvisShiftZ: number;
  leanForward: number;
  leanRight: number;
}

/** 绑定姿态与静止角色共用的脚底状态。 */
export const VANGUARD_GAIT_REST_POSE = Object.freeze({
  leftAnkleX: -FOOT_HALF_WIDTH,
  leftAnkleY: VANGUARD_ANATOMY.ankleY,
  leftAnkleZ: 0,
  rightAnkleX: FOOT_HALF_WIDTH,
  rightAnkleY: VANGUARD_ANATOMY.ankleY,
  rightAnkleZ: 0,
  bodyBob: 0,
  pelvisShiftX: 0,
  pelvisShiftZ: 0,
  leanForward: 0,
  leanRight: 0,
}) satisfies Readonly<VanguardGaitPoseState>;

/** 创建供动画系统跨帧复用的步态姿态输出。 */
export function createVanguardGaitPoseState(): VanguardGaitPoseState {
  return { ...VANGUARD_GAIT_REST_POSE };
}

/** 推进世界空间脚底锚点、支撑侧重心与加速度倾斜。 */
export function updateVanguardGaitState(
  data: VanguardData,
  index: number,
  deltaTime: number,
): void {
  const { transform, morphology, motion, animation, gait } = data;
  const blend = animation.locomotionBlend[index] ?? 0;
  const heading = transform.heading[index] ?? 0;
  const velocityX = motion.velocityX[index] ?? 0;
  const velocityZ = motion.velocityZ[index] ?? 0;
  if ((gait.initialized[index] ?? 0) === 0 || blend < MOVING_BLEND_THRESHOLD) {
    resetFoot(data, index, -1);
    resetFoot(data, index, 1);
    gait.initialized[index] = 1;
  }

  const baseCycle = wrapUnit((animation.locomotionPhase[index] ?? 0) / TAU);
  const leftCycle = baseCycle;
  const rightCycle = wrapUnit(baseCycle + 0.5);
  updateFoot(data, index, -1, leftCycle);
  updateFoot(data, index, 1, rightCycle);

  const leftSupport = (gait.leftPhase[index] as VanguardGaitPhase)
    === VanguardGaitPhase.Stance ? 1 : 0;
  const rightSupport = (gait.rightPhase[index] as VanguardGaitPhase)
    === VanguardGaitPhase.Stance ? 1 : 0;
  const braceSide = getBracedFootSide(data, index);
  const supportTarget = (
    (rightSupport - leftSupport) * 0.055
      + braceSide * 0.07
  ) * blend;
  updateSecondOrderResponse(
    gait.pelvisShiftX,
    gait.pelvisShiftXVelocity,
    index,
    supportTarget,
    12,
    1,
    deltaTime,
  );
  updateSecondOrderResponse(
    gait.pelvisShiftZ,
    gait.pelvisShiftZVelocity,
    index,
    Math.min(0.035, (motion.speed[index] ?? 0) / VANGUARD_CONFIG.maximumMoveSpeed * 0.035),
    10,
    1,
    deltaTime,
  );

  const inverseDelta = deltaTime > 0.000001 ? 1 / deltaTime : 0;
  const accelerationX = (velocityX - (gait.previousVelocityX[index] ?? velocityX))
    * inverseDelta;
  const accelerationZ = (velocityZ - (gait.previousVelocityZ[index] ?? velocityZ))
    * inverseDelta;
  const sine = Math.sin(heading);
  const cosine = Math.cos(heading);
  const localForwardAcceleration = accelerationX * sine + accelerationZ * cosine;
  const localRightAcceleration = accelerationX * cosine - accelerationZ * sine;
  const previousHeading = gait.previousHeading[index] ?? heading;
  const headingDelta = Math.atan2(
    Math.sin(heading - previousHeading),
    Math.cos(heading - previousHeading),
  );
  const turnRate = headingDelta * inverseDelta;
  const speedRatio = Math.min(1, (motion.speed[index] ?? 0) / VANGUARD_CONFIG.maximumMoveSpeed);
  const forwardTarget = clamp(localForwardAcceleration / 48, -1, 1) * 0.11;
  const rightTarget = -clamp(localRightAcceleration / 48, -1, 1) * 0.085
    - clamp(turnRate / 7, -1, 1) * speedRatio * 0.065;
  updateSecondOrderResponse(
    gait.leanForward,
    gait.leanForwardVelocity,
    index,
    forwardTarget,
    10,
    0.92,
    deltaTime,
  );
  updateSecondOrderResponse(
    gait.leanRight,
    gait.leanRightVelocity,
    index,
    rightTarget,
    10,
    0.92,
    deltaTime,
  );
  gait.previousVelocityX[index] = velocityX;
  gait.previousVelocityZ[index] = velocityZ;
  gait.previousHeading[index] = heading;

  if (!Number.isFinite(morphology.scale[index] ?? 1)) {
    throw new Error('主角步态要求有限的角色缩放。');
  }
}

/** 把世界脚底锚点转换为当前角色局部空间姿态。 */
export function writeVanguardGaitPoseState(
  data: VanguardData,
  index: number,
  result: VanguardGaitPoseState,
): void {
  const phase = wrapUnit((data.animation.locomotionPhase[index] ?? 0) / TAU);
  writeFootPose(data, index, -1, phase, result);
  writeFootPose(data, index, 1, wrapUnit(phase + 0.5), result);
  const halfStep = wrapUnit(phase * 2);
  const rise = halfStep < 0.5
    ? smootherStep(halfStep * 2)
    : smootherStep((1 - halfStep) * 2);
  const blend = data.animation.locomotionBlend[index] ?? 0;
  result.pelvisShiftX = data.gait.pelvisShiftX[index] ?? 0;
  result.pelvisShiftZ = data.gait.pelvisShiftZ[index] ?? 0;
  result.bodyBob = resolveReachablePelvisOffset(result, rise * 0.052 * blend, blend);
  result.leanForward = data.gait.leanForward[index] ?? 0;
  result.leanRight = data.gait.leanRight[index] ?? 0;
}

function updateFoot(
  data: VanguardData,
  index: number,
  side: -1 | 1,
  cycle: number,
): void {
  const gait = data.gait;
  const phaseField = side < 0 ? gait.leftPhase : gait.rightPhase;
  const previous = phaseField[index] as VanguardGaitPhase;
  if (isFootBraced(data, index, side)) {
    if (previous !== VanguardGaitPhase.Stance) {
      landFoot(data, index, side);
    }
    phaseField[index] = VanguardGaitPhase.Stance;
    return;
  }
  const next = getGaitPhase(cycle);
  if (next === VanguardGaitPhase.Stance && previous !== VanguardGaitPhase.Stance) {
    landFoot(data, index, side);
  } else if (next !== VanguardGaitPhase.Stance && previous === VanguardGaitPhase.Stance) {
    beginFootSwing(data, index, side);
  }
  phaseField[index] = next;
}

function resetFoot(data: VanguardData, index: number, side: -1 | 1): void {
  const { transform, morphology, gait } = data;
  const heading = transform.heading[index] ?? 0;
  const scale = morphology.scale[index] ?? 1;
  const localX = side * FOOT_HALF_WIDTH * scale;
  const worldX = (transform.x[index] ?? 0) + localX * Math.cos(heading);
  const worldZ = (transform.z[index] ?? 0) - localX * Math.sin(heading);
  const anchorX = side < 0 ? gait.leftAnchorX : gait.rightAnchorX;
  const anchorZ = side < 0 ? gait.leftAnchorZ : gait.rightAnchorZ;
  const startX = side < 0 ? gait.leftSwingStartX : gait.rightSwingStartX;
  const startZ = side < 0 ? gait.leftSwingStartZ : gait.rightSwingStartZ;
  const landingX = side < 0 ? gait.leftLandingX : gait.rightLandingX;
  const landingZ = side < 0 ? gait.leftLandingZ : gait.rightLandingZ;
  anchorX[index] = worldX;
  anchorZ[index] = worldZ;
  startX[index] = worldX;
  startZ[index] = worldZ;
  landingX[index] = worldX;
  landingZ[index] = worldZ;
  (side < 0 ? gait.leftPhase : gait.rightPhase)[index] = VanguardGaitPhase.Stance;
}

function beginFootSwing(data: VanguardData, index: number, side: -1 | 1): void {
  const { transform, morphology, motion, gait } = data;
  const anchorX = side < 0 ? gait.leftAnchorX : gait.rightAnchorX;
  const anchorZ = side < 0 ? gait.leftAnchorZ : gait.rightAnchorZ;
  const startX = side < 0 ? gait.leftSwingStartX : gait.rightSwingStartX;
  const startZ = side < 0 ? gait.leftSwingStartZ : gait.rightSwingStartZ;
  const landingX = side < 0 ? gait.leftLandingX : gait.rightLandingX;
  const landingZ = side < 0 ? gait.leftLandingZ : gait.rightLandingZ;
  startX[index] = anchorX[index] ?? transform.x[index] ?? 0;
  startZ[index] = anchorZ[index] ?? transform.z[index] ?? 0;
  const heading = transform.heading[index] ?? 0;
  const lateral = side * FOOT_HALF_WIDTH * (morphology.scale[index] ?? 1);
  const velocityX = motion.velocityX[index] ?? 0;
  const velocityZ = motion.velocityZ[index] ?? 0;
  const travelSpeed = Math.max(Math.hypot(velocityX, velocityZ), 0.0001);
  const travelDirectionX = velocityX / travelSpeed;
  const travelDirectionZ = velocityZ / travelSpeed;
  landingX[index] = (transform.x[index] ?? 0)
    + travelDirectionX * LANDING_LOOKAHEAD_DISTANCE
    + lateral * Math.cos(heading);
  landingZ[index] = (transform.z[index] ?? 0)
    + travelDirectionZ * LANDING_LOOKAHEAD_DISTANCE
    - lateral * Math.sin(heading);
}

function landFoot(data: VanguardData, index: number, side: -1 | 1): void {
  const gait = data.gait;
  const anchorX = side < 0 ? gait.leftAnchorX : gait.rightAnchorX;
  const anchorZ = side < 0 ? gait.leftAnchorZ : gait.rightAnchorZ;
  const landingX = side < 0 ? gait.leftLandingX : gait.rightLandingX;
  const landingZ = side < 0 ? gait.leftLandingZ : gait.rightLandingZ;
  anchorX[index] = landingX[index] ?? anchorX[index] ?? 0;
  anchorZ[index] = landingZ[index] ?? anchorZ[index] ?? 0;
}

function writeFootPose(
  data: VanguardData,
  index: number,
  side: -1 | 1,
  cycle: number,
  result: VanguardGaitPoseState,
): void {
  const { transform, morphology, animation, gait } = data;
  const anchorX = side < 0 ? gait.leftAnchorX : gait.rightAnchorX;
  const anchorZ = side < 0 ? gait.leftAnchorZ : gait.rightAnchorZ;
  const startX = side < 0 ? gait.leftSwingStartX : gait.rightSwingStartX;
  const startZ = side < 0 ? gait.leftSwingStartZ : gait.rightSwingStartZ;
  const landingX = side < 0 ? gait.leftLandingX : gait.rightLandingX;
  const landingZ = side < 0 ? gait.leftLandingZ : gait.rightLandingZ;
  const phaseValue = side < 0 ? gait.leftPhase[index] : gait.rightPhase[index];
  const phase = phaseValue as VanguardGaitPhase;
  const moving = phase !== VanguardGaitPhase.Stance;
  const swingAmount = moving ? smootherStep((cycle - STANCE_END) / (1 - STANCE_END)) : 0;
  const worldX = moving
    ? lerp(startX[index] ?? 0, landingX[index] ?? 0, swingAmount)
    : anchorX[index] ?? 0;
  const worldZ = moving
    ? lerp(startZ[index] ?? 0, landingZ[index] ?? 0, swingAmount)
    : anchorZ[index] ?? 0;
  const heading = transform.heading[index] ?? 0;
  const cosine = Math.cos(heading);
  const sine = Math.sin(heading);
  const scale = Math.max(0.0001, morphology.scale[index] ?? 1);
  const relativeX = worldX - (transform.x[index] ?? 0);
  const relativeZ = worldZ - (transform.z[index] ?? 0);
  const anchoredLocalX = (relativeX * cosine - relativeZ * sine) / scale;
  const anchoredLocalZ = (relativeX * sine + relativeZ * cosine) / scale;
  const blend = animation.locomotionBlend[index] ?? 0;
  const blendedLocalX = lerp(side * FOOT_HALF_WIDTH, anchoredLocalX, blend);
  const localX = side < 0
    ? Math.min(-MINIMUM_FOOT_LANE_OFFSET, blendedLocalX)
    : Math.max(MINIMUM_FOOT_LANE_OFFSET, blendedLocalX);
  const localZ = anchoredLocalZ * blend;
  const localY = VANGUARD_ANATOMY.ankleY + sampleFootLift(cycle) * blend;
  if (side < 0) {
    result.leftAnkleX = localX;
    result.leftAnkleY = localY;
    result.leftAnkleZ = localZ;
  } else {
    result.rightAnkleX = localX;
    result.rightAnkleY = localY;
    result.rightAnkleZ = localZ;
  }
}

/** 在保持脚底锚定的前提下下沉骨盆，避免腿长不足时把小腿与脚掌拉断。 */
function resolveReachablePelvisOffset(
  gait: Readonly<VanguardGaitPoseState>,
  aestheticBob: number,
  locomotionBlend: number,
): number {
  const maximumReach = VANGUARD_ANATOMY.thighLength
    + VANGUARD_ANATOMY.shinLength
    - LEG_REACH_SAFETY_MARGIN * locomotionBlend;
  const lateralShift = gait.pelvisShiftX * 0.75;
  const leftMaximumHipY = resolveMaximumHipY(
    -VANGUARD_ANATOMY.hipHalfWidth + lateralShift,
    gait.pelvisShiftZ,
    gait.leftAnkleX,
    gait.leftAnkleY,
    gait.leftAnkleZ,
    maximumReach,
  );
  const rightMaximumHipY = resolveMaximumHipY(
    VANGUARD_ANATOMY.hipHalfWidth + lateralShift,
    gait.pelvisShiftZ,
    gait.rightAnkleX,
    gait.rightAnkleY,
    gait.rightAnkleZ,
    maximumReach,
  );
  const reachOffset = Math.max(
    -MAXIMUM_GAIT_PELVIS_DROP,
    Math.min(leftMaximumHipY, rightMaximumHipY) - VANGUARD_ANATOMY.pelvisY,
  );
  return Math.min(aestheticBob, reachOffset);
}

/** 返回给定脚踝水平距离下保持双段腿可达的最高髋部高度。 */
function resolveMaximumHipY(
  hipX: number,
  hipZ: number,
  ankleX: number,
  ankleY: number,
  ankleZ: number,
  maximumReach: number,
): number {
  const offsetX = ankleX - hipX;
  const offsetZ = ankleZ - hipZ;
  const verticalReach = Math.sqrt(Math.max(
    0,
    maximumReach * maximumReach - offsetX * offsetX - offsetZ * offsetZ,
  ));
  return ankleY + verticalReach;
}

function sampleFootLift(cycle: number): number {
  if (cycle < STANCE_END) {
    return 0;
  }
  if (cycle < TOE_OFF_END) {
    return smootherStep((cycle - STANCE_END) / (TOE_OFF_END - STANCE_END)) * 0.08;
  }
  if (cycle < SWING_END) {
    const amount = (cycle - TOE_OFF_END) / (SWING_END - TOE_OFF_END);
    return 0.08 + 4 * amount * (1 - amount) * 0.28;
  }
  return (1 - smootherStep((cycle - SWING_END) / (1 - SWING_END))) * 0.08;
}

function getGaitPhase(cycle: number): VanguardGaitPhase {
  if (cycle < STANCE_END) {
    return VanguardGaitPhase.Stance;
  }
  if (cycle < TOE_OFF_END) {
    return VanguardGaitPhase.ToeOff;
  }
  if (cycle < SWING_END) {
    return VanguardGaitPhase.Swing;
  }
  return VanguardGaitPhase.HeelStrike;
}

function isFootBraced(
  data: VanguardData,
  index: number,
  side: -1 | 1,
): boolean {
  const action = data.intent.weaponAction[index] as VanguardWeaponAction;
  if (action === VanguardWeaponAction.Uppercut
    || action === VanguardWeaponAction.GroundSlam) {
    return true;
  }
  return getBracedFootSide(data, index) === side;
}

function getBracedFootSide(data: VanguardData, index: number): -1 | 0 | 1 {
  const action = data.intent.weaponAction[index] as VanguardWeaponAction;
  switch (action) {
    case VanguardWeaponAction.WindupLeft:
    case VanguardWeaponAction.SwingLeft:
    case VanguardWeaponAction.ChainPrepareLeft:
      return 1;
    case VanguardWeaponAction.WindupRight:
    case VanguardWeaponAction.SwingRight:
    case VanguardWeaponAction.ChainPrepareRight:
      return -1;
    case VanguardWeaponAction.Recover:
      return (data.intent.weaponActionSide[index] ?? 0) < 0 ? 1 : -1;
    case VanguardWeaponAction.Idle:
    case VanguardWeaponAction.Uppercut:
    case VanguardWeaponAction.GroundSlam:
    case VanguardWeaponAction.Spin:
    case VanguardWeaponAction.BowDraw:
    case VanguardWeaponAction.BowRelease:
      return 0;
  }
}

function wrapUnit(value: number): number {
  const wrapped = value % 1;
  return wrapped < 0 ? wrapped + 1 : wrapped;
}

function smootherStep(value: number): number {
  const amount = clamp(value, 0, 1);
  return amount * amount * amount * (amount * (amount * 6 - 15) + 10);
}

function lerp(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}
