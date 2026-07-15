import { EntityTable } from '../../../../../core/entities/entity-table';
import {
  mixRandomSeed,
  nextRandom,
  normalizeRandomSeed,
  randomRange,
} from '../../../../../core/math/xorshift32';
import { TAU } from '../../../../../core/math/scalar';
import { CurveCrawlerAction } from './curve-crawler-action';
import {
  type NormalizedCurveCrawlerPopulationOptions,
} from './curve-crawler-options';
import {
  CURVE_CRAWLER_LEG_COUNT,
  CURVE_CRAWLER_SCHEMA,
  type CurveCrawlerData,
  type CurveCrawlerTable,
} from './curve-crawler-schema';

/**
 * 聚合 Curve Crawler 的 SoA 表。
 */
export class CurveCrawlerState {
  public readonly table: CurveCrawlerTable;
  public readonly data: CurveCrawlerData;

  constructor(options: NormalizedCurveCrawlerPopulationOptions) {
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
  const { identity, transform, morphology, behavior, intent, motion, animation } = state.data;
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

    const column = index % columns;
    const row = Math.floor(index / columns);
    transform.x[index] = -options.spawnArea.width * 0.5
      + (column + 0.5) * cellWidth
      + randomRange(layoutState, 0, -cellWidth * 0.28, cellWidth * 0.28);
    transform.y[index] = -options.spawnArea.height * 0.5
      + (row + 0.5) * cellHeight
      + randomRange(layoutState, 0, -cellHeight * 0.28, cellHeight * 0.28);

    const heading = randomRange(identity.randomState, index, -Math.PI, Math.PI);
    transform.heading[index] = heading;
    transform.targetHeading[index] = heading;

    morphology.bodyLength[index] = randomRange(identity.randomState, index, 5.2, 7.2);
    morphology.bodyWidth[index] = randomRange(identity.randomState, index, 3.4, 4.7);
    morphology.legLength[index] = randomRange(identity.randomState, index, 7.8, 11.5);
    morphology.legWidth[index] = randomRange(identity.randomState, index, 0.58, 0.92);
    morphology.eyeRadius[index] = randomRange(identity.randomState, index, 0.35, 0.55);
    morphology.cruiseSpeed[index] = randomRange(identity.randomState, index, 7, 14);

    behavior.action[index] = CurveCrawlerAction.Crawl;
    behavior.actionTime[index] = randomRange(identity.randomState, index, 0.3, 3.5);
    behavior.actionDuration[index] = behavior.actionTime[index] ?? 1;
    behavior.selectedWaveLeg[index] = 0;
    behavior.nextTurnTime[index] = randomRange(identity.randomState, index, 0.8, 4.5);

    intent.targetSpeed[index] = morphology.cruiseSpeed[index] ?? 0;
    intent.targetCrouch[index] = 0;
    intent.targetWave[index] = 0;
    intent.gaitMultiplier[index] = 1;
    intent.turnRate[index] = 2.3;
    motion.currentSpeed[index] = 0;

    animation.phase[index] = randomRange(identity.randomState, index, 0, TAU);
    animation.bodyPulse[index] = 0;
    animation.crouchAmount[index] = 0;
    animation.waveAmount[index] = 0;
    animation.wavePhase[index] = randomRange(identity.randomState, index, 0, TAU);
    animation.blinkScale[index] = 1;
    animation.nextBlinkTime[index] = randomRange(identity.randomState, index, 1.5, 6);
    animation.blinkTime[index] = 0;

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
