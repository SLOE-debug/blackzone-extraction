import {
  defineEntitySchema,
  entityField,
  type EntityData,
} from '../../../../../core/entities/entity-schema';
import { type EntityTable } from '../../../../../core/entities/entity-table';

/** Curve Crawler 每个实体拥有的腿部数量。 */
export const CURVE_CRAWLER_LEG_COUNT = 8;

/**
 * Curve Crawler 的 SoA 组件 Schema。
 *
 * 组件按系统职责分组，使行为、移动、动画和几何系统只读取所需切片。
 */
export const CURVE_CRAWLER_SCHEMA = defineEntitySchema({
  identity: {
    id: entityField(Uint32Array, 1),
    randomState: entityField(Uint32Array, 1),
  },
  transform: {
    x: entityField(Float32Array, 1),
    y: entityField(Float32Array, 1),
    heading: entityField(Float32Array, 1),
    targetHeading: entityField(Float32Array, 1),
  },
  morphology: {
    bodyLength: entityField(Float32Array, 1),
    bodyWidth: entityField(Float32Array, 1),
    legLength: entityField(Float32Array, 1),
    legWidth: entityField(Float32Array, 1),
    eyeRadius: entityField(Float32Array, 1),
    cruiseSpeed: entityField(Float32Array, 1),
  },
  behavior: {
    action: entityField(Uint8Array, 1),
    actionTime: entityField(Float32Array, 1),
    actionDuration: entityField(Float32Array, 1),
    selectedWaveLeg: entityField(Uint8Array, 1),
    nextTurnTime: entityField(Float32Array, 1),
  },
  intent: {
    targetSpeed: entityField(Float32Array, 1),
    targetCrouch: entityField(Float32Array, 1),
    targetWave: entityField(Float32Array, 1),
    gaitMultiplier: entityField(Float32Array, 1),
    turnRate: entityField(Float32Array, 1),
  },
  motion: {
    currentSpeed: entityField(Float32Array, 1),
  },
  animation: {
    phase: entityField(Float32Array, 1),
    bodyPulse: entityField(Float32Array, 1),
    crouchAmount: entityField(Float32Array, 1),
    waveAmount: entityField(Float32Array, 1),
    wavePhase: entityField(Float32Array, 1),
    blinkScale: entityField(Float32Array, 1),
    nextBlinkTime: entityField(Float32Array, 1),
    blinkTime: entityField(Float32Array, 1),
    legPhaseOffsets: entityField(Float32Array, CURVE_CRAWLER_LEG_COUNT),
  },
} as const);

/** Curve Crawler SoA 数据的完整推导类型。 */
export type CurveCrawlerData = EntityData<typeof CURVE_CRAWLER_SCHEMA>;

/** Curve Crawler 实体表的完整推导类型。 */
export type CurveCrawlerTable = EntityTable<typeof CURVE_CRAWLER_SCHEMA>;
