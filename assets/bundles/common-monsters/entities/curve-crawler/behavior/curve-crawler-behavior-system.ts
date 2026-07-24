import { type EntitySystem } from '../../../../../core/entities/entity-system';
import { MonsterLifecycleState } from '../../../../../core/contracts/monster-lifecycle';
import { MonsterManipulationState } from '../../../../../core/contracts/monster-manipulation';
import { nextRandom, randomRange } from '../../../../../core/math/xorshift32';
import { CurveCrawlerAction } from '../model/curve-crawler-action';
import { type CurveCrawlerState } from '../model/curve-crawler-state';
import {
  CURVE_CRAWLER_AUTONOMOUS_SPEED_SHARPNESS,
  CurveCrawlerMotionProfile,
} from '../model/curve-crawler-motion-profile';

/**
 * 负责动作选择、动作计时和系统间共享的运动/姿态意图。
 */
export class CurveCrawlerBehaviorSystem implements EntitySystem<CurveCrawlerState, number> {
  /** 推进全部实体的行为状态。 */
  public update(state: CurveCrawlerState, deltaTime: number): void {
    const { identity, transform, morphology, vitality, manipulation, behavior, combat, intent } =
      state.data;

    for (let index = 0; index < state.count; index++) {
      if ((vitality.state[index] as MonsterLifecycleState) !== MonsterLifecycleState.Alive) {
        intent.targetSpeed[index] = 0;
        intent.targetCrouch[index] = 0;
        intent.targetBite[index] = 0;
        intent.targetTurn[index] = 0;
        intent.gaitMultiplier[index] = 0;
        continue;
      }
      if ((manipulation.state[index] as MonsterManipulationState)
        !== MonsterManipulationState.Free) {
        intent.targetSpeed[index] = 0;
        intent.targetBite[index] = 0;
        intent.gaitMultiplier[index] = 0;
        continue;
      }

      if (state.motionProfile === CurveCrawlerMotionProfile.ObservationDisplay) {
        continue;
      }
      if ((combat.engaged[index] ?? 0) !== 0) {
        continue;
      }

      behavior.actionTime[index] = (behavior.actionTime[index] ?? 0) - deltaTime;
      behavior.nextTurnTime[index] = (behavior.nextTurnTime[index] ?? 0) - deltaTime;

      if ((behavior.actionTime[index] ?? 0) <= 0) {
        this.chooseAction(state, index);
      }

      const action = behavior.action[index] as CurveCrawlerAction;
      if ((behavior.nextTurnTime[index] ?? 0) <= 0
        && action !== CurveCrawlerAction.Pause) {
        transform.targetHeading[index] = (transform.targetHeading[index] ?? 0)
          + randomRange(identity.randomState, index, -0.85, 0.85);
        behavior.nextTurnTime[index] = randomRange(identity.randomState, index, 1.2, 5.5);
      }

      intent.targetSpeed[index] = morphology.cruiseSpeed[index] ?? 0;
      intent.speedSharpness[index] = CURVE_CRAWLER_AUTONOMOUS_SPEED_SHARPNESS;
      intent.targetCrouch[index] = 0;
      intent.targetBite[index] = 0;
      intent.targetTurn[index] = 0;
      intent.gaitMultiplier[index] = 1;
      intent.gaitDirection[index] = 1;
      intent.turnRate[index] = action === CurveCrawlerAction.Scuttle ? 4.5 : 2.3;

      switch (action) {
        case CurveCrawlerAction.Crawl:
          break;
        case CurveCrawlerAction.Pause:
          intent.targetSpeed[index] = 0;
          intent.gaitMultiplier[index] = 0.18;
          break;
        case CurveCrawlerAction.Scuttle:
          intent.targetSpeed[index] = (morphology.cruiseSpeed[index] ?? 0) * 2.15;
          intent.gaitMultiplier[index] = 1.8;
          break;
        case CurveCrawlerAction.Crouch:
          intent.targetSpeed[index] = 0;
          intent.targetCrouch[index] = 1;
          intent.gaitMultiplier[index] = 0.2;
          break;
        case CurveCrawlerAction.Turn:
          intent.targetSpeed[index] = (morphology.cruiseSpeed[index] ?? 0) * 0.35;
          intent.targetTurn[index] = 1;
          intent.gaitMultiplier[index] = 0.75;
          break;
        case CurveCrawlerAction.Pursue:
        case CurveCrawlerAction.Bite:
          throw new Error(`战斗行为未被战斗系统接管：${action}`);
        default:
          throw new Error(`未知的 Curve Crawler 行为状态：${action}`);
      }
    }
  }

  /** 让全部实体立即进入短时疾跑状态。 */
  public triggerScuttle(state: CurveCrawlerState): void {
    const { identity, vitality, manipulation, behavior } = state.data;
    for (let index = 0; index < state.count; index++) {
      if ((vitality.state[index] as MonsterLifecycleState) !== MonsterLifecycleState.Alive) {
        continue;
      }
      if ((manipulation.state[index] as MonsterManipulationState)
        !== MonsterManipulationState.Free) {
        continue;
      }
      behavior.action[index] = CurveCrawlerAction.Scuttle;
      behavior.actionTime[index] = randomRange(identity.randomState, index, 0.9, 2.2);
      behavior.actionDuration[index] = behavior.actionTime[index] ?? 1;
    }
  }

  private chooseAction(state: CurveCrawlerState, index: number): void {
    const { identity, transform, behavior, intent } = state.data;
    const roll = nextRandom(identity.randomState, index);

    if (roll < 0.5) {
      this.setAction(state, index, CurveCrawlerAction.Crawl, 1.6, 5.5);
    } else if (roll < 0.66) {
      this.setAction(state, index, CurveCrawlerAction.Pause, 0.5, 2.1);
    } else if (roll < 0.83) {
      this.setAction(state, index, CurveCrawlerAction.Scuttle, 0.65, 1.8);
    } else if (roll < 0.94) {
      this.setAction(state, index, CurveCrawlerAction.Crouch, 0.55, 1.4);
    } else {
      const turnAngle = nextRandom(identity.randomState, index) < 0.5
        ? -Math.PI * 0.8
        : Math.PI * 0.8;
      transform.targetHeading[index] = (transform.targetHeading[index] ?? 0) + turnAngle;
      intent.turnDirection[index] = Math.sign(turnAngle);
      this.setAction(state, index, CurveCrawlerAction.Turn, 0.7, 1.6);
    }
  }

  private setAction(
    state: CurveCrawlerState,
    index: number,
    action: CurveCrawlerAction,
    minimumDuration: number,
    maximumDuration: number,
  ): void {
    const { identity, behavior } = state.data;
    behavior.action[index] = action;
    behavior.actionDuration[index] = randomRange(
      identity.randomState,
      index,
      minimumDuration,
      maximumDuration,
    );
    behavior.actionTime[index] = behavior.actionDuration[index] ?? minimumDuration;
  }
}
