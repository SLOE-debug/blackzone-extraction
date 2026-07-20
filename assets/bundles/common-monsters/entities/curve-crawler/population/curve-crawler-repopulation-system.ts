import { randomRange } from '../../../../../core/math/xorshift32';
import { TAU } from '../../../../../core/math/scalar';
import { CurveCrawlerAction } from '../model/curve-crawler-action';
import { CURVE_CRAWLER_EMERGENCE_TIMING } from '../model/curve-crawler-emergence';
import { CurveCrawlerLifePhase, CURVE_CRAWLER_MAX_HEALTH } from '../model/curve-crawler-life';
import { CURVE_CRAWLER_AUTONOMOUS_SPEED_SHARPNESS } from '../model/curve-crawler-motion-profile';
import {
  type CurveCrawlerRepopulationOptions,
  validateCurveCrawlerRepopulationOptions,
} from '../model/curve-crawler-repopulation-options';
import {
  CURVE_CRAWLER_FRAGMENT_COUNT,
} from '../model/curve-crawler-schema';
import { type CurveCrawlerState } from '../model/curve-crawler-state';

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/** 在固定 SoA 槽位内维持玩家周围的活体数量并回收远距离实体。 */
export class CurveCrawlerRepopulationSystem {
  private spawnSequence = 0;

  /** 首次创建尸潮时把全部槽位均匀散布到指定环带并立即设为存活。 */
  public initializeAround(
    state: CurveCrawlerState,
    options: Readonly<CurveCrawlerRepopulationOptions>,
  ): void {
    validateCurveCrawlerRepopulationOptions(options, state.count);
    for (let index = 0; index < state.count; index++) {
      this.respawn(state, index, options, CurveCrawlerLifePhase.Alive);
    }
  }

  /** 回收超出半径和已经消失的槽位，并强制补足最低活体数量。 */
  public maintainAround(
    state: CurveCrawlerState,
    options: Readonly<CurveCrawlerRepopulationOptions>,
  ): void {
    validateCurveCrawlerRepopulationOptions(options, state.count);
    const { transform, vitality } = state.data;
    const recycleDistanceSquared = options.recycleRadius * options.recycleRadius;
    let aliveCount = 0;
    for (let index = 0; index < state.count; index++) {
      let phase = vitality.phase[index] as CurveCrawlerLifePhase;
      const deltaX = (transform.x[index] ?? 0) - options.centerX;
      const deltaY = (transform.y[index] ?? 0) - options.centerY;
      if (deltaX * deltaX + deltaY * deltaY > recycleDistanceSquared) {
        this.respawn(state, index, options, CurveCrawlerLifePhase.Emerging);
        phase = CurveCrawlerLifePhase.Emerging;
      } else if (phase === CurveCrawlerLifePhase.Gone) {
        this.respawn(state, index, options, CurveCrawlerLifePhase.Emerging);
        phase = CurveCrawlerLifePhase.Emerging;
      }
      if (phase === CurveCrawlerLifePhase.Alive) {
        aliveCount++;
      }
    }

    if (aliveCount >= options.minimumAliveCount) {
      return;
    }
    for (let index = 0; index < state.count && aliveCount < options.minimumAliveCount; index++) {
      const phase = vitality.phase[index] as CurveCrawlerLifePhase;
      if (phase === CurveCrawlerLifePhase.Alive
        || phase === CurveCrawlerLifePhase.Emerging) {
        continue;
      }
      this.respawn(state, index, options, CurveCrawlerLifePhase.Alive);
      aliveCount++;
    }
    while (aliveCount < options.minimumAliveCount) {
      const emergenceIndex = this.findMostAdvancedEmergence(state);
      if (emergenceIndex < 0) {
        throw new Error('Curve Crawler 固定容量不足以补足最低活体数。');
      }
      this.finishEmergenceImmediately(state, emergenceIndex);
      aliveCount++;
    }
  }

  /** 返回当前真正处于可追击、可受击阶段的实体数量。 */
  public countAlive(state: CurveCrawlerState): number {
    let aliveCount = 0;
    for (let index = 0; index < state.count; index++) {
      if ((state.data.vitality.phase[index] as CurveCrawlerLifePhase)
        === CurveCrawlerLifePhase.Alive) {
        aliveCount++;
      }
    }
    return aliveCount;
  }

  /** 在环带上重置单一实体的变换、生命、行为、战斗和可见动画状态。 */
  private respawn(
    state: CurveCrawlerState,
    index: number,
    options: Readonly<CurveCrawlerRepopulationOptions>,
    phase: CurveCrawlerLifePhase.Alive | CurveCrawlerLifePhase.Emerging,
  ): void {
    const { identity, transform, morphology, vitality, behavior, combat } = state.data;
    const { intent, motion, animation } = state.data;
    const angle = this.spawnSequence * GOLDEN_ANGLE
      + randomRange(identity.randomState, index, -0.21, 0.21);
    this.spawnSequence = (this.spawnSequence + 1) % 0x1000000;
    const innerSquared = options.spawnInnerRadius * options.spawnInnerRadius;
    const outerSquared = options.spawnOuterRadius * options.spawnOuterRadius;
    const radius = Math.sqrt(randomRange(
      identity.randomState,
      index,
      innerSquared,
      outerSquared,
    ));
    transform.x[index] = options.centerX + Math.cos(angle) * radius;
    transform.y[index] = options.centerY + Math.sin(angle) * radius;
    const heading = angle + Math.PI;
    transform.heading[index] = heading;
    transform.targetHeading[index] = heading;

    vitality.health[index] = CURVE_CRAWLER_MAX_HEALTH;
    vitality.phase[index] = phase;
    vitality.phaseTime[index] = phase === CurveCrawlerLifePhase.Emerging
      ? -randomRange(
        identity.randomState,
        index,
        0,
        CURVE_CRAWLER_EMERGENCE_TIMING.maximumStaggerJitter,
      )
      : 0;
    vitality.hitTime[index] = 0;
    behavior.action[index] = CurveCrawlerAction.Crawl;
    behavior.actionTime[index] = randomRange(identity.randomState, index, 0.2, 1.4);
    behavior.actionDuration[index] = behavior.actionTime[index] ?? 1;
    behavior.nextTurnTime[index] = randomRange(identity.randomState, index, 0.8, 3.4);
    combat.engaged[index] = 0;
    combat.attackTime[index] = 0;
    combat.attackCooldown[index] = randomRange(identity.randomState, index, 0.15, 1.1);
    combat.impactApplied[index] = 0;
    intent.targetSpeed[index] = morphology.cruiseSpeed[index] ?? 0;
    intent.speedSharpness[index] = CURVE_CRAWLER_AUTONOMOUS_SPEED_SHARPNESS;
    intent.targetCrouch[index] = 0;
    intent.targetBite[index] = 0;
    intent.targetTurn[index] = 0;
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
    animation.nextBlinkTime[index] = randomRange(identity.randomState, index, 1.2, 5.5);
    animation.blinkTime[index] = 0;
    animation.hitFlash[index] = 0;
    animation.crackSpread[index] = 0;
    animation.crackVisibility[index] = 0;
    animation.eggScale[index] = 0;
    animation.eggBulge[index] = 0;
    animation.eggBurst[index] = phase === CurveCrawlerLifePhase.Alive ? 1 : 0;
    animation.emergenceBodyScale[index] = phase === CurveCrawlerLifePhase.Alive ? 1 : 0;
    animation.emergenceLegScale[index] = phase === CurveCrawlerLifePhase.Alive ? 1 : 0;
    animation.surfaceCollapse[index] = 0;
    animation.liquidSpread[index] = 0;
    animation.liquidDrain[index] = 0;

    const fragmentOffset = index * CURVE_CRAWLER_FRAGMENT_COUNT;
    for (let fragment = 0; fragment < CURVE_CRAWLER_FRAGMENT_COUNT; fragment++) {
      const offset = fragmentOffset + fragment;
      animation.fragmentOffsetX[offset] = 0;
      animation.fragmentOffsetY[offset] = 0;
      animation.fragmentOffsetZ[offset] = 0;
      animation.fragmentRotation[offset] = 0;
    }
  }

  /** 找出最接近完成的出生实体，优先保留刚被回收实体的完整演出。 */
  private findMostAdvancedEmergence(state: CurveCrawlerState): number {
    const { vitality } = state.data;
    let selectedIndex = -1;
    let greatestPhaseTime = Number.NEGATIVE_INFINITY;
    for (let index = 0; index < state.count; index++) {
      if ((vitality.phase[index] as CurveCrawlerLifePhase)
        !== CurveCrawlerLifePhase.Emerging) {
        continue;
      }
      const phaseTime = vitality.phaseTime[index] ?? 0;
      if (phaseTime > greatestPhaseTime) {
        selectedIndex = index;
        greatestPhaseTime = phaseTime;
      }
    }
    return selectedIndex;
  }

  /** 尸潮跌破硬下限时只完成最老的出生槽位，不再次移动它。 */
  private finishEmergenceImmediately(state: CurveCrawlerState, index: number): void {
    const { vitality, animation } = state.data;
    vitality.phase[index] = CurveCrawlerLifePhase.Alive;
    vitality.phaseTime[index] = 0;
    animation.crackSpread[index] = 0;
    animation.crackVisibility[index] = 0;
    animation.eggScale[index] = 0;
    animation.eggBulge[index] = 0;
    animation.eggBurst[index] = 1;
    animation.emergenceBodyScale[index] = 1;
    animation.emergenceLegScale[index] = 1;
  }
}
