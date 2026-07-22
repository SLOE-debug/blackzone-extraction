import {
  isMonsterLifecycleResident,
  MonsterLifecycleState,
} from '../../../../../core/contracts/monster-lifecycle';
import {
  transitionMonsterLifecycle,
} from '../../../../../core/monsters/monster-lifecycle-state-machine';
import {
  MonsterPopulationActivationSystem,
  type MonsterPopulationActivationTarget,
} from '../../../../../core/monsters/monster-population-activation-system';
import { randomRange } from '../../../../../core/math/xorshift32';
import { TAU } from '../../../../../core/math/scalar';
import { CurveCrawlerAction } from '../model/curve-crawler-action';
import { CURVE_CRAWLER_EMERGENCE_TIMING } from '../model/curve-crawler-emergence';
import { CurveCrawlerDeathStage, CURVE_CRAWLER_MAX_HEALTH } from '../model/curve-crawler-life';
import { CURVE_CRAWLER_AUTONOMOUS_SPEED_SHARPNESS } from '../model/curve-crawler-motion-profile';
import {
  type CurveCrawlerRepopulationOptions,
  validateCurveCrawlerRepopulationOptions,
} from '../model/curve-crawler-repopulation-options';
import { CURVE_CRAWLER_FRAGMENT_COUNT } from '../model/curve-crawler-schema';
import { type CurveCrawlerState } from '../model/curve-crawler-state';
import { EntityRenderDirty } from '../../../../../core/rendering/dynamic-entities/entity-render-dirty';

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/** 在 Curve Crawler 固定 SoA 容量内实现通用生命周期激活适配与环带回收。 */
export class CurveCrawlerRepopulationSystem
implements MonsterPopulationActivationTarget<CurveCrawlerRepopulationOptions> {
  private readonly activation = new MonsterPopulationActivationSystem<
    CurveCrawlerRepopulationOptions
  >();
  private spawnSequence = 0;

  constructor(private readonly state: CurveCrawlerState) {}

  public get capacity(): number {
    return this.state.count;
  }

  /** 读取指定槽位的通用生命周期状态，供 core 激活调度器选择空闲槽位。 */
  public getLifecycleState(entityIndex: number): MonsterLifecycleState {
    return this.state.data.vitality.state[entityIndex] as MonsterLifecycleState;
  }

  /**
   * 把一个休眠或死亡完成槽位放入玩家外圈，并完整启动出生动画。
   *
   * `delaySeconds` 由通用人口调度器按本次激活顺序生成，避免同一波实体同时破土。
   */
  public beginSpawning(
    entityIndex: number,
    options: Readonly<CurveCrawlerRepopulationOptions>,
    delaySeconds: number,
  ): void {
    this.respawn(entityIndex, options, delaySeconds);
  }

  /** 回收远离玩家的非死亡实体，并把空闲槽位补到当前期望驻留数量。 */
  public maintainAround(options: Readonly<CurveCrawlerRepopulationOptions>): void {
    validateCurveCrawlerRepopulationOptions(options, this.state.count);
    this.recycleDistantResidents(options);
    this.activation.synchronize(
      this,
      options,
      options.desiredPopulationCount,
      CURVE_CRAWLER_EMERGENCE_TIMING.staggerPerEntity,
    );
  }

  /** 返回当前真正处于可追击、可受击状态的实体数量。 */
  public countAlive(): number {
    let aliveCount = 0;
    for (let index = 0; index < this.state.count; index++) {
      if ((this.state.data.vitality.state[index] as MonsterLifecycleState)
        === MonsterLifecycleState.Alive) {
        aliveCount++;
      }
    }
    return aliveCount;
  }

  /** 是否至少有一个槽位仍需要推进可见生命周期。 */
  public hasResidents(): boolean {
    const lifecycle = this.state.data.vitality.state;
    for (let index = 0; index < this.state.count; index++) {
      if (isMonsterLifecycleResident(lifecycle[index] as MonsterLifecycleState)) {
        return true;
      }
    }
    return false;
  }

  /** 只回收远距离的出生或存活实体，绝不截断正在进行的死亡表现。 */
  private recycleDistantResidents(
    options: Readonly<CurveCrawlerRepopulationOptions>,
  ): void {
    const { transform, vitality } = this.state.data;
    const recycleDistanceSquared = options.recycleRadius * options.recycleRadius;
    for (let index = 0; index < this.state.count; index++) {
      const lifecycleState = vitality.state[index] as MonsterLifecycleState;
      if (lifecycleState !== MonsterLifecycleState.Spawning
        && lifecycleState !== MonsterLifecycleState.Alive) {
        continue;
      }
      const deltaX = (transform.x[index] ?? 0) - options.centerX;
      const deltaY = (transform.y[index] ?? 0) - options.centerY;
      if (deltaX * deltaX + deltaY * deltaY <= recycleDistanceSquared) {
        continue;
      }
      transitionMonsterLifecycle(vitality, index, MonsterLifecycleState.Dormant);
      this.hideDormantSlot(index);
      this.state.renderChanges.mark(index, EntityRenderDirty.Color);
    }
  }

  /** 在环带上重置单一槽位的变换、战斗数据和全部可见动画输入。 */
  private respawn(
    index: number,
    options: Readonly<CurveCrawlerRepopulationOptions>,
    delaySeconds: number,
  ): void {
    const state = this.state;
    const { identity, transform, morphology, vitality, death, behavior, combat } = state.data;
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
    transform.headingCosine[index] = Math.cos(heading);
    transform.headingSine[index] = Math.sin(heading);
    transform.targetHeading[index] = heading;

    const staggerJitter = randomRange(
      identity.randomState,
      index,
      0,
      CURVE_CRAWLER_EMERGENCE_TIMING.maximumStaggerJitter,
    );
    transitionMonsterLifecycle(
      vitality,
      index,
      MonsterLifecycleState.Spawning,
      -(delaySeconds + staggerJitter),
    );
    vitality.health[index] = CURVE_CRAWLER_MAX_HEALTH;
    vitality.hitTime[index] = 0;
    death.stage[index] = CurveCrawlerDeathStage.Bursting;
    death.stageTime[index] = 0;
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
    animation.eggBurst[index] = 0;
    animation.emergenceBodyScale[index] = 0;
    animation.emergenceLegScale[index] = 0;
    animation.surfaceCollapse[index] = 0;
    animation.liquidSpread[index] = 0;
    animation.liquidDrain[index] = 0;
    this.resetFragmentAnimation(index);
    state.renderChanges.mark(index, EntityRenderDirty.Color);
  }

  /** 将被远距离回收的槽位立即收拢为不可见休眠几何。 */
  private hideDormantSlot(index: number): void {
    const { animation, motion, intent } = this.state.data;
    motion.currentSpeed[index] = 0;
    intent.targetSpeed[index] = 0;
    animation.crackSpread[index] = 0;
    animation.crackVisibility[index] = 0;
    animation.eggScale[index] = 0;
    animation.eggBulge[index] = 0;
    animation.eggBurst[index] = 0;
    animation.emergenceBodyScale[index] = 0;
    animation.emergenceLegScale[index] = 0;
    animation.surfaceCollapse[index] = 1;
    animation.liquidSpread[index] = 0;
    animation.liquidDrain[index] = 0;
    this.resetFragmentAnimation(index);
  }

  private resetFragmentAnimation(index: number): void {
    const animation = this.state.data.animation;
    const fragmentOffset = index * CURVE_CRAWLER_FRAGMENT_COUNT;
    for (let fragment = 0; fragment < CURVE_CRAWLER_FRAGMENT_COUNT; fragment++) {
      const offset = fragmentOffset + fragment;
      animation.fragmentOffsetX[offset] = 0;
      animation.fragmentOffsetY[offset] = 0;
      animation.fragmentOffsetZ[offset] = 0;
      animation.fragmentRotation[offset] = 0;
    }
  }
}
