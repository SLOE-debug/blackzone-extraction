import {
  defineEntitySchema,
  entityField,
  type EntityData,
} from '../../../core/entities/entity-schema';
import { type EntityTable } from '../../../core/entities/entity-table';
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
    aimX: entityField(Float32Array, 1),
    aimZ: entityField(Float32Array, 1),
    aiming: entityField(Uint8Array, 1),
  },
  motion: {
    velocityX: entityField(Float32Array, 1),
    velocityZ: entityField(Float32Array, 1),
    speed: entityField(Float32Array, 1),
  },
  animation: {
    idlePhase: entityField(Float32Array, 1),
    locomotionPhase: entityField(Float32Array, 1),
    locomotionBlend: entityField(Float32Array, 1),
  },
  pose: {
    boneMatrices: entityField(
      Float32Array,
      VanguardBone.Count * VANGUARD_BONE_MATRIX_COMPONENTS,
    ),
  },
} as const);

/** 主角 SoA 数据的完整推导类型。 */
export type VanguardData = EntityData<typeof VANGUARD_SCHEMA>;

/** 主角实体表的完整推导类型。 */
export type VanguardTable = EntityTable<typeof VANGUARD_SCHEMA>;
