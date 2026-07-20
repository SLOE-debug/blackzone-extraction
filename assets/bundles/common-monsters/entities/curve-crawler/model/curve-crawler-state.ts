import { EntityTable } from '../../../../../core/entities/entity-table';
import { MonsterObservationEventType } from '../../../../../core/contracts/monster-observation';
import {
  mixRandomSeed,
  nextRandom,
  normalizeRandomSeed,
  randomRange,
} from '../../../../../core/math/xorshift32';
import { TAU } from '../../../../../core/math/scalar';
import { CurveCrawlerAction } from './curve-crawler-action';
import { CURVE_CRAWLER_EMERGENCE_TIMING } from './curve-crawler-emergence';
import { CURVE_CRAWLER_MAX_HEALTH, CurveCrawlerLifePhase } from './curve-crawler-life';
import {
  type NormalizedCurveCrawlerPopulationOptions,
} from './curve-crawler-options';
import {
  CURVE_CRAWLER_AUTONOMOUS_SPEED_SHARPNESS,
  CURVE_CRAWLER_OBSERVATION_SPEED_SHARPNESS,
  CurveCrawlerMotionProfile,
} from './curve-crawler-motion-profile';
import {
  CURVE_CRAWLER_LEG_COUNT,
  CURVE_CRAWLER_FRAGMENT_COUNT,
  CURVE_CRAWLER_LIQUID_RAY_COUNT,
  CURVE_CRAWLER_SCHEMA,
  type CurveCrawlerData,
  type CurveCrawlerTable,
} from './curve-crawler-schema';

const FRAGMENT_GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/**
 * 聚合 Curve Crawler 的 SoA 表。
 */
export class CurveCrawlerState {
  public readonly table: CurveCrawlerTable;
  public readonly data: CurveCrawlerData;
  public readonly motionProfile: CurveCrawlerMotionProfile;
  public readonly movementBounds: Readonly<{
    centerX: number;
    centerY: number;
    halfWidth: number;
    halfHeight: number;
  }>;

  constructor(options: NormalizedCurveCrawlerPopulationOptions) {
    this.motionProfile = options.motionProfile;
    this.movementBounds = Object.freeze({
      centerX: options.spawnArea.centerX,
      centerY: options.spawnArea.centerY,
      halfWidth: options.spawnArea.width * 0.5,
      halfHeight: options.spawnArea.height * 0.5,
    });
    this.table = new EntityTable(CURVE_CRAWLER_SCHEMA, options.count);
    this.table.allocate(options.count);
    this.data = this.table.data;
    initializeCurveCrawlerData(this, options);
  }

  /** 当前活动实体数量。 */
  public get count(): number {
    return this.table.count;
  }
}

function initializeCurveCrawlerData(
  state: CurveCrawlerState,
  options: NormalizedCurveCrawlerPopulationOptions,
): void {
  const {
    identity,
    transform,
    morphology,
    vitality,
    death,
    behavior,
    combat,
    observation,
    intent,
    motion,
    animation,
  } = state.data;
  const layoutState = new Uint32Array(1);
  layoutState[0] = normalizeRandomSeed(options.seed ^ 0x51f15e5d);

  const aspect = options.spawnArea.width / Math.max(options.spawnArea.height, 1);
  const columns = Math.max(1, Math.ceil(Math.sqrt(options.count * aspect)));
  const rows = Math.ceil(options.count / columns);
  const cellWidth = options.spawnArea.width / columns;
  const cellHeight = options.spawnArea.height / rows;

  for (let index = 0; index < options.count; index++) {
    identity.id[index] = index;
    identity.randomState[index] = mixRandomSeed(options.seed, index);
    identity.appearanceSeed[index] = mixRandomSeed(options.seed ^ 0x73a4d91, index);

    const column = index % columns;
    const row = Math.floor(index / columns);
    transform.x[index] = options.spawnArea.centerX - options.spawnArea.width * 0.5
      + (column + 0.5) * cellWidth
      + randomRange(layoutState, 0, -cellWidth * 0.28, cellWidth * 0.28);
    transform.y[index] = options.spawnArea.centerY - options.spawnArea.height * 0.5
      + (row + 0.5) * cellHeight
      + randomRange(layoutState, 0, -cellHeight * 0.28, cellHeight * 0.28);

    const observationDisplay = options.motionProfile
      === CurveCrawlerMotionProfile.ObservationDisplay;
    // 展示蜘蛛沿本地 -Y 朝向观察窗；根节点旋转后该方向对应大厅世界 +Z。
    const heading = observationDisplay
      ? -Math.PI * 0.5
      : randomRange(identity.randomState, index, -Math.PI, Math.PI);
    transform.heading[index] = heading;
    transform.targetHeading[index] = heading;

    morphology.bodyLength[index] = observationDisplay
      ? randomRange(identity.randomState, index, 6.1, 6.4)
      : randomRange(identity.randomState, index, 5.2, 7.2);
    morphology.bodyWidth[index] = observationDisplay
      ? randomRange(identity.randomState, index, 4.05, 4.25)
      : randomRange(identity.randomState, index, 3.4, 4.7);
    morphology.legLength[index] = observationDisplay
      ? randomRange(identity.randomState, index, 9.3, 9.8)
      : randomRange(identity.randomState, index, 7.8, 11.5);
    morphology.legWidth[index] = observationDisplay
      ? randomRange(identity.randomState, index, 0.72, 0.8)
      : randomRange(identity.randomState, index, 0.58, 0.92);
    morphology.eyeRadius[index] = observationDisplay
      ? randomRange(identity.randomState, index, 0.48, 0.53)
      : randomRange(identity.randomState, index, 0.35, 0.55);
    morphology.cruiseSpeed[index] = observationDisplay
      ? randomRange(identity.randomState, index, 2.8, 3.35)
      : randomRange(identity.randomState, index, 7, 14);

    const liquidRadiusOffset = index * CURVE_CRAWLER_LIQUID_RAY_COUNT;
    for (let ray = 0; ray < CURVE_CRAWLER_LIQUID_RAY_COUNT; ray++) {
      morphology.liquidRadiusScales[liquidRadiusOffset + ray] = randomRange(
        identity.randomState,
        index,
        0.72,
        1.2,
      );
    }

    vitality.health[index] = CURVE_CRAWLER_MAX_HEALTH;
    const emerging = options.motionProfile === CurveCrawlerMotionProfile.Autonomous;
    vitality.phase[index] = emerging
      ? CurveCrawlerLifePhase.Emerging
      : CurveCrawlerLifePhase.Alive;
    vitality.phaseTime[index] = emerging
      ? -(index * CURVE_CRAWLER_EMERGENCE_TIMING.staggerPerEntity
        + randomRange(
          identity.randomState,
          index,
          0,
          CURVE_CRAWLER_EMERGENCE_TIMING.maximumStaggerJitter,
        ))
      : 0;
    vitality.hitTime[index] = 0;

    const fragmentOffset = index * CURVE_CRAWLER_FRAGMENT_COUNT;
    const fragmentAngleOrigin = randomRange(identity.randomState, index, 0, TAU);
    for (let fragment = 0; fragment < CURVE_CRAWLER_FRAGMENT_COUNT; fragment++) {
      const angle = fragmentAngleOrigin + fragment * FRAGMENT_GOLDEN_ANGLE
        + randomRange(identity.randomState, index, -0.46, 0.46);
      const spinDirection = nextRandom(identity.randomState, index) < 0.5 ? -1 : 1;
      death.fragmentDirectionX[fragmentOffset + fragment] = Math.cos(angle);
      death.fragmentDirectionY[fragmentOffset + fragment] = Math.sin(angle);
      death.fragmentTravelDistance[fragmentOffset + fragment] = randomRange(
        identity.randomState,
        index,
        7,
        15,
      );
      death.fragmentLiftHeight[fragmentOffset + fragment] = randomRange(
        identity.randomState,
        index,
        2.8,
        7.5,
      );
      death.fragmentSpinSpeed[fragmentOffset + fragment] = spinDirection * randomRange(
        identity.randomState,
        index,
        3.5,
        8.5,
      );
      animation.fragmentOffsetX[fragmentOffset + fragment] = 0;
      animation.fragmentOffsetY[fragmentOffset + fragment] = 0;
      animation.fragmentOffsetZ[fragmentOffset + fragment] = 0;
      animation.fragmentRotation[fragmentOffset + fragment] = 0;
    }

    behavior.action[index] = CurveCrawlerAction.Crawl;
    behavior.actionTime[index] = randomRange(identity.randomState, index, 0.3, 3.5);
    behavior.actionDuration[index] = behavior.actionTime[index] ?? 1;
    behavior.nextTurnTime[index] = randomRange(identity.randomState, index, 0.8, 4.5);

    combat.engaged[index] = 0;
    combat.attackTime[index] = 0;
    combat.attackCooldown[index] = 0;
    combat.impactApplied[index] = 0;

    observation.eventType[index] = MonsterObservationEventType.Wander;
    observation.eventTime[index] = 0;
    observation.eventDuration[index] = 1;
    observation.signedTurnAngle[index] = 0;
    observation.forwardSpeed[index] = 0;
    observation.lateralSpeed[index] = 0;
    observation.turnRate[index] = 0;

    intent.targetSpeed[index] = morphology.cruiseSpeed[index] ?? 0;
    intent.speedSharpness[index] = options.motionProfile
      === CurveCrawlerMotionProfile.ObservationDisplay
      ? CURVE_CRAWLER_OBSERVATION_SPEED_SHARPNESS
      : CURVE_CRAWLER_AUTONOMOUS_SPEED_SHARPNESS;
    intent.targetCrouch[index] = 0;
    intent.targetBite[index] = 0;
    intent.targetTurn[index] = 0;
    intent.turnDirection[index] = 1;
    intent.gaitMultiplier[index] = 1;
    intent.gaitDirection[index] = 1;
    intent.turnRate[index] = 2.3;
    motion.currentSpeed[index] = 0;

    animation.phase[index] = randomRange(identity.randomState, index, 0, TAU);
    animation.bodyPulse[index] = 0;
    animation.crouchAmount[index] = 0;
    animation.biteAmount[index] = 0;
    animation.turnAmount[index] = 0;
    animation.turnDirection[index] = 1;
    animation.blinkScale[index] = 1;
    animation.nextBlinkTime[index] = randomRange(identity.randomState, index, 1.5, 6);
    animation.blinkTime[index] = 0;
    animation.hitFlash[index] = 0;
    animation.crackSpread[index] = 0;
    animation.crackVisibility[index] = 0;
    animation.eggScale[index] = 0;
    animation.eggBulge[index] = 0;
    animation.eggBurst[index] = emerging ? 0 : 1;
    animation.emergenceBodyScale[index] = emerging ? 0 : 1;
    animation.emergenceLegScale[index] = emerging ? 0 : 1;
    animation.surfaceCollapse[index] = 0;
    animation.liquidSpread[index] = 0;
    animation.liquidDrain[index] = 0;

    const phaseOffset = index * CURVE_CRAWLER_LEG_COUNT;
    for (let leg = 0; leg < CURVE_CRAWLER_LEG_COUNT; leg++) {
      const alternatingPhase = leg === 1 || leg === 3 || leg === 4 || leg === 6 ? Math.PI : 0;
      animation.legPhaseOffsets[phaseOffset + leg] = alternatingPhase
        + randomRange(identity.randomState, index, -0.18, 0.18);
    }

    // 提前推进一次，确保不同实体即使输入种子相邻也不会保留初始化模式。
    nextRandom(identity.randomState, index);
  }
}
