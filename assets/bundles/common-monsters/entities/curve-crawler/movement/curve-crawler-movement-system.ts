import { type EntitySystem } from '../../../../../core/entities/entity-system';
import { MonsterLifecycleState } from '../../../../../core/contracts/monster-lifecycle';
import { damp, dampAngle } from '../../../../../core/math/scalar';
import { type CurveCrawlerState } from '../model/curve-crawler-state';
import {
  CURVE_CRAWLER_AUTONOMOUS_SPEED_SHARPNESS,
  CurveCrawlerMotionProfile,
} from '../model/curve-crawler-motion-profile';

/** 负责速度、朝向和不受区域边界限制的位移。 */
export class CurveCrawlerMovementSystem implements EntitySystem<CurveCrawlerState, number> {
  /** 推进全部实体的移动状态。 */
  public update(state: CurveCrawlerState, deltaTime: number): void {
    const { transform, vitality, intent, motion } = state.data;

    for (let index = 0; index < state.count; index++) {
      if ((vitality.state[index] as MonsterLifecycleState) !== MonsterLifecycleState.Alive) {
        motion.currentSpeed[index] = 0;
        continue;
      }

      const currentSpeed = damp(
        motion.currentSpeed[index] ?? 0,
        intent.targetSpeed[index] ?? 0,
        intent.speedSharpness[index] ?? CURVE_CRAWLER_AUTONOMOUS_SPEED_SHARPNESS,
        deltaTime,
      );
      const heading = dampAngle(
        transform.heading[index] ?? 0,
        transform.targetHeading[index] ?? 0,
        intent.turnRate[index] ?? 2.3,
        deltaTime,
      );
      const headingCosine = Math.cos(heading);
      const headingSine = Math.sin(heading);
      motion.currentSpeed[index] = currentSpeed;
      transform.heading[index] = heading;
      transform.headingCosine[index] = headingCosine;
      transform.headingSine[index] = headingSine;
      if (state.motionProfile === CurveCrawlerMotionProfile.ObservationDisplay) {
        continue;
      }
      transform.x[index] = (transform.x[index] ?? 0) + headingCosine * currentSpeed * deltaTime;
      transform.y[index] = (transform.y[index] ?? 0) + headingSine * currentSpeed * deltaTime;
    }
  }
}
