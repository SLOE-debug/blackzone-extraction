import {
  defineEntitySchema,
  entityField,
  type EntityData,
} from '../../../core/entities/entity-schema';
import { type EntityTable } from '../../../core/entities/entity-table';
import { VANGUARD_MANTLE_PARTICLE_COUNT } from './vanguard-mantle-particles';
import { VanguardBone, VANGUARD_BONE_MATRIX_COMPONENTS } from './vanguard-bone';
import { VANGUARD_QUATERNION_COMPONENTS } from '../rigging/vanguard-pose-math';
import { VANGUARD_LOCAL_POSITION_COMPONENTS } from '../rigging/vanguard-rig';

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
    aimX: entityField(Float32Array, 1),
    aimZ: entityField(Float32Array, 1),
    aimPitch: entityField(Float32Array, 1),
    aiming: entityField(Uint8Array, 1),
    weaponPose: entityField(Uint8Array, 1),
    weaponAction: entityField(Uint8Array, 1),
    weaponActionProgress: entityField(Float32Array, 1),
  },
  motion: {
    velocityX: entityField(Float32Array, 1),
    velocityZ: entityField(Float32Array, 1),
    speed: entityField(Float32Array, 1),
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
  pose: {
    localPositions: entityField(
      Float32Array,
      VanguardBone.Count * VANGUARD_LOCAL_POSITION_COMPONENTS,
    ),
    localRotations: entityField(
      Float32Array,
      VanguardBone.Count * VANGUARD_QUATERNION_COMPONENTS,
    ),
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
