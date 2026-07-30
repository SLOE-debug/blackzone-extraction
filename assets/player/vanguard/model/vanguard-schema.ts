import {
  defineEntitySchema,
  entityField,
  type EntityData,
} from '../../../core/entities/entity-schema';
import { type EntityTable } from '../../../core/entities/entity-table';
import { VANGUARD_MANTLE_PARTICLE_COUNT } from './vanguard-mantle-particles';
import { VanguardBone, VANGUARD_BONE_MATRIX_COMPONENTS } from './vanguard-bone';

/** 可复用主角的 SoA 组件 Schema。 */
export const VANGUARD_SCHEMA = defineEntitySchema({
  transform: {
    x: entityField(Float32Array, 1),
    y: entityField(Float32Array, 1),
    z: entityField(Float32Array, 1),
    heading: entityField(Float32Array, 1),
  },
  morphology: {
    scale: entityField(Float32Array, 1),
  },
  intent: {
    action: entityField(Uint8Array, 1),
    moveX: entityField(Float32Array, 1),
    moveZ: entityField(Float32Array, 1),
    attackX: entityField(Float32Array, 1),
    attackZ: entityField(Float32Array, 1),
    attacking: entityField(Uint8Array, 1),
    facingPolicy: entityField(Uint8Array, 1),
    desiredHeading: entityField(Float32Array, 1),
    maximumTurnSpeed: entityField(Float32Array, 1),
    weaponPose: entityField(Uint8Array, 1),
    weaponAction: entityField(Uint8Array, 1),
    weaponActionProgress: entityField(Float32Array, 1),
    weaponActionSide: entityField(Int8Array, 1),
  },
  motion: {
    velocityX: entityField(Float32Array, 1),
    velocityZ: entityField(Float32Array, 1),
    speed: entityField(Float32Array, 1),
    locomotionForward: entityField(Float32Array, 1),
    locomotionRight: entityField(Float32Array, 1),
  },
  vitality: {
    health: entityField(Float32Array, 1),
    phase: entityField(Uint8Array, 1),
    hitTime: entityField(Float32Array, 1),
  },
  animation: {
    idlePhase: entityField(Float32Array, 1),
    locomotionPhase: entityField(Float32Array, 1),
    locomotionBlend: entityField(Float32Array, 1),
    weaponPose: entityField(Uint8Array, 1),
    weaponStanceBlend: entityField(Float32Array, 1),
    hitFlash: entityField(Float32Array, 1),
  },
  gait: {
    initialized: entityField(Uint8Array, 1),
    leftPhase: entityField(Uint8Array, 1),
    rightPhase: entityField(Uint8Array, 1),
    leftAnchorX: entityField(Float32Array, 1),
    leftAnchorZ: entityField(Float32Array, 1),
    rightAnchorX: entityField(Float32Array, 1),
    rightAnchorZ: entityField(Float32Array, 1),
    leftSwingStartX: entityField(Float32Array, 1),
    leftSwingStartZ: entityField(Float32Array, 1),
    rightSwingStartX: entityField(Float32Array, 1),
    rightSwingStartZ: entityField(Float32Array, 1),
    leftLandingX: entityField(Float32Array, 1),
    leftLandingZ: entityField(Float32Array, 1),
    rightLandingX: entityField(Float32Array, 1),
    rightLandingZ: entityField(Float32Array, 1),
    pelvisShiftX: entityField(Float32Array, 1),
    pelvisShiftXVelocity: entityField(Float32Array, 1),
    pelvisShiftZ: entityField(Float32Array, 1),
    pelvisShiftZVelocity: entityField(Float32Array, 1),
    leanForward: entityField(Float32Array, 1),
    leanForwardVelocity: entityField(Float32Array, 1),
    leanRight: entityField(Float32Array, 1),
    leanRightVelocity: entityField(Float32Array, 1),
    previousVelocityX: entityField(Float32Array, 1),
    previousVelocityZ: entityField(Float32Array, 1),
    previousHeading: entityField(Float32Array, 1),
  },
  weaponAnimation: {
    chestYaw: entityField(Float32Array, 1),
    chestYawVelocity: entityField(Float32Array, 1),
    pelvisYaw: entityField(Float32Array, 1),
    pelvisYawVelocity: entityField(Float32Array, 1),
    leftElbowPoleX: entityField(Float32Array, 1),
    leftElbowPoleY: entityField(Float32Array, 1),
    leftElbowPoleZ: entityField(Float32Array, 1),
    rightElbowPoleX: entityField(Float32Array, 1),
    rightElbowPoleY: entityField(Float32Array, 1),
    rightElbowPoleZ: entityField(Float32Array, 1),
    mainGripWeight: entityField(Float32Array, 1),
    supportGripWeight: entityField(Float32Array, 1),
    hammerLag: entityField(Float32Array, 1),
    hammerLagVelocity: entityField(Float32Array, 1),
  },
  pose: {
    boneMatrices: entityField(
      Float32Array,
      VanguardBone.Count * VANGUARD_BONE_MATRIX_COMPONENTS,
    ),
  },
  mantle: {
    positionX: entityField(Float32Array, VANGUARD_MANTLE_PARTICLE_COUNT),
    positionY: entityField(Float32Array, VANGUARD_MANTLE_PARTICLE_COUNT),
    positionZ: entityField(Float32Array, VANGUARD_MANTLE_PARTICLE_COUNT),
    previousX: entityField(Float32Array, VANGUARD_MANTLE_PARTICLE_COUNT),
    previousY: entityField(Float32Array, VANGUARD_MANTLE_PARTICLE_COUNT),
    previousZ: entityField(Float32Array, VANGUARD_MANTLE_PARTICLE_COUNT),
    accumulator: entityField(Float32Array, 1),
    elapsedTime: entityField(Float32Array, 1),
    rootX: entityField(Float32Array, 1),
    rootY: entityField(Float32Array, 1),
    rootZ: entityField(Float32Array, 1),
    rootHeading: entityField(Float32Array, 1),
    rootScale: entityField(Float32Array, 1),
    initialized: entityField(Uint8Array, 1),
  },
} as const);

/** 主角 SoA 数据的完整推导类型。 */
export type VanguardData = EntityData<typeof VANGUARD_SCHEMA>;

/** 主角实体表的完整推导类型。 */
export type VanguardTable = EntityTable<typeof VANGUARD_SCHEMA>;
