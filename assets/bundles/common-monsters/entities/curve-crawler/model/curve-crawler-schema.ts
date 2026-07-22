import {
  defineEntitySchema,
  entityField,
  type EntityData,
} from '../../../../../core/entities/entity-schema';
import { type EntityTable } from '../../../../../core/entities/entity-table';

/** Curve Crawler 每个实体拥有的腿部数量。 */
export const CURVE_CRAWLER_LEG_COUNT = 8;

/** Curve Crawler 液体轮廓使用的固定射线数量。 */
export const CURVE_CRAWLER_LIQUID_RAY_COUNT = 18;

/** Curve Crawler 死亡时独立飞散的腿、躯干和眼睛碎块数量。 */
export const CURVE_CRAWLER_FRAGMENT_COUNT = CURVE_CRAWLER_LEG_COUNT + 4;

/** Curve Crawler 非腿部碎块在固定碎块数组中的索引。 */
export enum CurveCrawlerFragmentIndex {
  Abdomen = CURVE_CRAWLER_LEG_COUNT,
  Thorax,
  LeftEye,
  RightEye,
}

/**
 * Curve Crawler 的 SoA 组件 Schema。
 *
 * 组件按系统职责分组，使行为、移动、动画和几何系统只读取所需切片。
 */
export const CURVE_CRAWLER_SCHEMA = defineEntitySchema({
  identity: {
    id: entityField(Uint32Array, 1),
    randomState: entityField(Uint32Array, 1),
    appearanceSeed: entityField(Uint32Array, 1),
  },
  transform: {
    x: entityField(Float32Array, 1),
    y: entityField(Float32Array, 1),
    heading: entityField(Float32Array, 1),
    headingCosine: entityField(Float32Array, 1),
    headingSine: entityField(Float32Array, 1),
    targetHeading: entityField(Float32Array, 1),
  },
  morphology: {
    bodyLength: entityField(Float32Array, 1),
    bodyWidth: entityField(Float32Array, 1),
    legLength: entityField(Float32Array, 1),
    legWidth: entityField(Float32Array, 1),
    eyeRadius: entityField(Float32Array, 1),
    cruiseSpeed: entityField(Float32Array, 1),
    liquidRadiusScales: entityField(Float32Array, CURVE_CRAWLER_LIQUID_RAY_COUNT),
  },
  vitality: {
    health: entityField(Float32Array, 1),
    state: entityField(Uint8Array, 1),
    stateTime: entityField(Float32Array, 1),
    hitTime: entityField(Float32Array, 1),
    timeSinceHit: entityField(Float32Array, 1),
  },
  death: {
    stage: entityField(Uint8Array, 1),
    stageTime: entityField(Float32Array, 1),
    fragmentDirectionX: entityField(Float32Array, CURVE_CRAWLER_FRAGMENT_COUNT),
    fragmentDirectionY: entityField(Float32Array, CURVE_CRAWLER_FRAGMENT_COUNT),
    fragmentTravelDistance: entityField(Float32Array, CURVE_CRAWLER_FRAGMENT_COUNT),
    fragmentLiftHeight: entityField(Float32Array, CURVE_CRAWLER_FRAGMENT_COUNT),
    fragmentSpinSpeed: entityField(Float32Array, CURVE_CRAWLER_FRAGMENT_COUNT),
  },
  behavior: {
    action: entityField(Uint8Array, 1),
    actionTime: entityField(Float32Array, 1),
    actionDuration: entityField(Float32Array, 1),
    nextTurnTime: entityField(Float32Array, 1),
  },
  combat: {
    engaged: entityField(Uint8Array, 1),
    attackTime: entityField(Float32Array, 1),
    attackCooldown: entityField(Float32Array, 1),
    impactApplied: entityField(Uint8Array, 1),
  },
  observation: {
    eventType: entityField(Uint8Array, 1),
    eventTime: entityField(Float32Array, 1),
    eventDuration: entityField(Float32Array, 1),
    signedTurnAngle: entityField(Float32Array, 1),
    forwardSpeed: entityField(Float32Array, 1),
    lateralSpeed: entityField(Float32Array, 1),
    turnRate: entityField(Float32Array, 1),
  },
  intent: {
    targetSpeed: entityField(Float32Array, 1),
    speedSharpness: entityField(Float32Array, 1),
    targetCrouch: entityField(Float32Array, 1),
    targetBite: entityField(Float32Array, 1),
    targetTurn: entityField(Float32Array, 1),
    turnDirection: entityField(Float32Array, 1),
    gaitMultiplier: entityField(Float32Array, 1),
    gaitDirection: entityField(Float32Array, 1),
    turnRate: entityField(Float32Array, 1),
  },
  motion: {
    currentSpeed: entityField(Float32Array, 1),
  },
  animation: {
    phase: entityField(Float32Array, 1),
    bodyPulse: entityField(Float32Array, 1),
    crouchAmount: entityField(Float32Array, 1),
    biteAmount: entityField(Float32Array, 1),
    turnAmount: entityField(Float32Array, 1),
    turnDirection: entityField(Float32Array, 1),
    blinkScale: entityField(Float32Array, 1),
    nextBlinkTime: entityField(Float32Array, 1),
    blinkTime: entityField(Float32Array, 1),
    hitFlash: entityField(Float32Array, 1),
    crackSpread: entityField(Float32Array, 1),
    crackVisibility: entityField(Float32Array, 1),
    eggScale: entityField(Float32Array, 1),
    eggBulge: entityField(Float32Array, 1),
    eggBurst: entityField(Float32Array, 1),
    emergenceBodyScale: entityField(Float32Array, 1),
    emergenceLegScale: entityField(Float32Array, 1),
    surfaceCollapse: entityField(Float32Array, 1),
    liquidSpread: entityField(Float32Array, 1),
    liquidDrain: entityField(Float32Array, 1),
    fragmentOffsetX: entityField(Float32Array, CURVE_CRAWLER_FRAGMENT_COUNT),
    fragmentOffsetY: entityField(Float32Array, CURVE_CRAWLER_FRAGMENT_COUNT),
    fragmentOffsetZ: entityField(Float32Array, CURVE_CRAWLER_FRAGMENT_COUNT),
    fragmentRotation: entityField(Float32Array, CURVE_CRAWLER_FRAGMENT_COUNT),
    legPhaseCosines: entityField(Float32Array, CURVE_CRAWLER_LEG_COUNT),
    legPhaseSines: entityField(Float32Array, CURVE_CRAWLER_LEG_COUNT),
  },
} as const);

/** Curve Crawler SoA 数据的完整推导类型。 */
export type CurveCrawlerData = EntityData<typeof CURVE_CRAWLER_SCHEMA>;

/** Curve Crawler 实体表的完整推导类型。 */
export type CurveCrawlerTable = EntityTable<typeof CURVE_CRAWLER_SCHEMA>;
