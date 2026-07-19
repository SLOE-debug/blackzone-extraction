import {
  MonsterObservationEventType,
  type MonsterObservationEvent,
} from '../../../../../core/contracts/monster-observation';
import { type EntitySystem } from '../../../../../core/entities/entity-system';
import { CurveCrawlerAction } from '../model/curve-crawler-action';
import { CurveCrawlerLifePhase } from '../model/curve-crawler-life';
import {
  CURVE_CRAWLER_OBSERVATION_SPEED_SHARPNESS,
  CurveCrawlerMotionProfile,
} from '../model/curve-crawler-motion-profile';
import { type CurveCrawlerState } from '../model/curve-crawler-state';

const OBSERVING_MOTION_DEAD_ZONE = 0.24;

/** 把通用观察事件转换为 Curve Crawler 独有的动作与步态意图。 */
export class CurveCrawlerObservationSystem implements EntitySystem<CurveCrawlerState, number> {
  /** 按当前观察事件和场景真实位移刷新全部展示实体的动作意图。 */
  public update(state: CurveCrawlerState, deltaTime: number): void {
    if (state.motionProfile !== CurveCrawlerMotionProfile.ObservationDisplay) {
      return;
    }

    const { morphology, vitality, behavior, observation, intent } = state.data;
    for (let index = 0; index < state.count; index++) {
      if ((vitality.phase[index] as CurveCrawlerLifePhase) !== CurveCrawlerLifePhase.Alive) {
        intent.targetSpeed[index] = 0;
        intent.targetCrouch[index] = 0;
        intent.targetBite[index] = 0;
        intent.targetTurn[index] = 0;
        intent.gaitMultiplier[index] = 0;
        continue;
      }

      observation.eventTime[index] = Math.min(
        (observation.eventTime[index] ?? 0) + deltaTime,
        observation.eventDuration[index] ?? 0,
      );

      const eventType = observation.eventType[index] as MonsterObservationEventType;
      const forwardSpeed = observation.forwardSpeed[index] ?? 0;
      const lateralSpeed = observation.lateralSpeed[index] ?? 0;
      const turnRate = observation.turnRate[index] ?? 0;
      const linearSpeed = Math.hypot(forwardSpeed, lateralSpeed);
      const turnTravelRadius = Math.max(
        (morphology.bodyWidth[index] ?? 0) * 0.55,
        (morphology.legLength[index] ?? 0) * 0.28,
      );
      const turnTravelSpeed = Math.abs(turnRate) * turnTravelRadius;
      let locomotionSpeed = Math.max(linearSpeed, turnTravelSpeed);

      intent.targetCrouch[index] = 0;
      intent.targetBite[index] = 0;
      intent.targetTurn[index] = 0;
      intent.gaitMultiplier[index] = 1;
      intent.turnDirection[index] = Math.sign(
        observation.signedTurnAngle[index] ?? 0,
      ) || 1;
      intent.gaitDirection[index] = eventType === MonsterObservationEventType.Turn
        ? intent.turnDirection[index] ?? 1
        : getGaitDirection(forwardSpeed, turnRate);
      intent.turnRate[index] = 0;

      switch (eventType) {
        case MonsterObservationEventType.Wander:
          behavior.action[index] = CurveCrawlerAction.Crawl;
          break;
        case MonsterObservationEventType.Turn:
          behavior.action[index] = CurveCrawlerAction.Turn;
          intent.targetTurn[index] = 1;
          intent.gaitMultiplier[index] = 0.9;
          break;
        case MonsterObservationEventType.Approach:
          behavior.action[index] = CurveCrawlerAction.Crawl;
          intent.targetCrouch[index] = 0.08;
          break;
        case MonsterObservationEventType.Observe:
          behavior.action[index] = CurveCrawlerAction.Pause;
          intent.targetCrouch[index] = 0.16;
          if (locomotionSpeed < OBSERVING_MOTION_DEAD_ZONE) {
            locomotionSpeed = 0;
          }
          break;
        case MonsterObservationEventType.Retreat:
          behavior.action[index] = CurveCrawlerAction.Crawl;
          intent.targetCrouch[index] = 0.1;
          intent.gaitMultiplier[index] = 0.88;
          break;
        default:
          throw new Error(`未知的 Curve Crawler 观察事件：${eventType}`);
      }

      intent.targetSpeed[index] = locomotionSpeed;
      intent.speedSharpness[index] = CURVE_CRAWLER_OBSERVATION_SPEED_SHARPNESS;
    }
  }

  /** 让展示实体进入场景发布的新观察阶段。 */
  public enter(state: CurveCrawlerState, event: MonsterObservationEvent): void {
    ensureObservationDisplay(state);
    validateObservationEvent(event);

    const { observation } = state.data;
    const signedTurnAngle = event.type === MonsterObservationEventType.Turn
      ? event.signedAngle
      : 0;
    for (let index = 0; index < state.count; index++) {
      observation.eventType[index] = event.type;
      observation.eventTime[index] = 0;
      observation.eventDuration[index] = event.duration;
      observation.signedTurnAngle[index] = signedTurnAngle;
    }
  }

  /** 保存场景根节点的真实局部速度，避免展示步态与位移脱节。 */
  public synchronizeMotion(
    state: CurveCrawlerState,
    forwardSpeed: number,
    lateralSpeed: number,
    turnRate: number,
  ): void {
    ensureObservationDisplay(state);
    if (!Number.isFinite(forwardSpeed)
      || !Number.isFinite(lateralSpeed)
      || !Number.isFinite(turnRate)) {
      throw new Error('Curve Crawler 观察运动必须使用有限数值。');
    }

    const { observation } = state.data;
    for (let index = 0; index < state.count; index++) {
      observation.forwardSpeed[index] = forwardSpeed;
      observation.lateralSpeed[index] = lateralSpeed;
      observation.turnRate[index] = turnRate;
    }
  }
}

/** 根据主要移动方向决定腿部相位向前还是向后推进。 */
function getGaitDirection(
  forwardSpeed: number,
  turnRate: number,
): number {
  if (Math.abs(forwardSpeed) > 0.04) {
    return Math.sign(forwardSpeed);
  }
  if (Math.abs(turnRate) > 0.01) {
    return Math.sign(turnRate);
  }
  return 1;
}

/** 确保观察控制不会误用到自主游荡群体。 */
function ensureObservationDisplay(state: CurveCrawlerState): void {
  if (state.motionProfile !== CurveCrawlerMotionProfile.ObservationDisplay) {
    throw new Error('只有观察展示用途的 Curve Crawler 才能接收观察事件。');
  }
}

/** 校验跨 Feature 观察事件的公共数值契约。 */
function validateObservationEvent(event: MonsterObservationEvent): void {
  if (!Number.isFinite(event.duration) || event.duration <= 0) {
    throw new Error('怪物观察事件持续时间必须是有限正数。');
  }
  if (event.type === MonsterObservationEventType.Turn
    && (!Number.isFinite(event.signedAngle) || Math.abs(event.signedAngle) < 0.001)) {
    throw new Error('怪物转身事件必须提供有效的有符号转角。');
  }
}
