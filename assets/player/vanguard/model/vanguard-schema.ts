import {
  defineEntitySchema,
  entityField,
  type EntityData,
} from '../../../core/entities/entity-schema';
import { type EntityTable } from '../../../core/entities/entity-table';

/** 主角固定姿态中的语义关节点。 */
export enum VanguardJoint {
  PelvisBottom,
  PelvisTop,
  ChestBottom,
  ChestTop,
  Neck,
  HeadJaw,
  HeadBrow,
  HeadTop,
  LeftHip,
  LeftKnee,
  LeftAnkle,
  LeftToe,
  RightHip,
  RightKnee,
  RightAnkle,
  RightToe,
  LeftShoulderInner,
  LeftShoulder,
  LeftShoulderOuter,
  LeftElbow,
  LeftHand,
  LeftPalmEnd,
  RightShoulderInner,
  RightShoulder,
  RightShoulderOuter,
  RightElbow,
  RightHand,
  RightPalmEnd,
  ChestLeftBottom,
  ChestLeftTop,
  ChestRightBottom,
  ChestRightTop,
  PouchLeftBottom,
  PouchLeftTop,
  PouchCenterBottom,
  PouchCenterTop,
  PouchRightBottom,
  PouchRightTop,
  LeftKneePlateBottom,
  LeftKneePlateTop,
  RightKneePlateBottom,
  RightKneePlateTop,
  LeftThighPlateBottom,
  LeftThighPlateTop,
  RightThighPlateBottom,
  RightThighPlateTop,
  EyeInner,
  EyeOuter,
  LeftTempleLightBottom,
  LeftTempleLightTop,
  RightTempleLightBottom,
  RightTempleLightTop,
  LeftForearmLightBottom,
  LeftForearmLightTop,
  RightForearmLightBottom,
  RightForearmLightTop,
  WeaponRear,
  WeaponFront,
  WeaponMuzzle,
  WeaponGripBottom,
  AntennaBase,
  AntennaTip,
  LeftHipPanelBottom,
  LeftHipPanelTop,
  RightHipPanelBottom,
  RightHipPanelTop,
  Count,
}

/** 可复用主角的 SoA 组件 Schema。 */
export const VANGUARD_SCHEMA = defineEntitySchema({
  transform: {
    x: entityField(Float32Array, 1),
    y: entityField(Float32Array, 1),
    z: entityField(Float32Array, 1),
    heading: entityField(Float32Array, 1),
  },
  morphology: {
    statureScale: entityField(Float32Array, 1),
    shoulderScale: entityField(Float32Array, 1),
    limbScale: entityField(Float32Array, 1),
    armorScale: entityField(Float32Array, 1),
    weaponScale: entityField(Float32Array, 1),
  },
  intent: {
    action: entityField(Uint8Array, 1),
    targetSpeed: entityField(Float32Array, 1),
    targetWeaponReady: entityField(Float32Array, 1),
  },
  motion: {
    currentSpeed: entityField(Float32Array, 1),
  },
  animation: {
    phase: entityField(Float32Array, 1),
    bodyBob: entityField(Float32Array, 1),
    weaponReady: entityField(Float32Array, 1),
  },
  joints: {
    x: entityField(Float32Array, VanguardJoint.Count),
    y: entityField(Float32Array, VanguardJoint.Count),
    z: entityField(Float32Array, VanguardJoint.Count),
  },
} as const);

/** 主角 SoA 数据的完整推导类型。 */
export type VanguardData = EntityData<typeof VANGUARD_SCHEMA>;

/** 主角实体表的完整推导类型。 */
export type VanguardTable = EntityTable<typeof VANGUARD_SCHEMA>;
