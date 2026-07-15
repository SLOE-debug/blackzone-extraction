import { type EntitySystem } from '../../../../../core/entities/entity-system';
import { damp, dampAngle } from '../../../../../core/math/scalar';
import { randomRange } from '../../../../../core/math/xorshift32';
import { type CurveCrawlerState } from '../model/curve-crawler-state';

/** 负责速度、朝向、位移和活动区域边界。 */
export class CurveCrawlerMovementSystem implements EntitySystem<CurveCrawlerState, number> {
  /** 推进全部实体的移动状态。 */
  public update(state: CurveCrawlerState, deltaTime: number): void {
    const { identity, transform, morphology, intent, motion } = state.data;

    for (let index = 0; index < state.count; index++) {
      const currentSpeed = damp(
        motion.currentSpeed[index] ?? 0,
        intent.targetSpeed[index] ?? 0,
        4.5,
        deltaTime,
      );
      const heading = dampAngle(
        transform.heading[index] ?? 0,
        transform.targetHeading[index] ?? 0,
        intent.turnRate[index] ?? 2.3,
        deltaTime,
      );
      motion.currentSpeed[index] = currentSpeed;
      transform.heading[index] = heading;
      transform.x[index] = (transform.x[index] ?? 0) + Math.cos(heading) * currentSpeed * deltaTime;
      transform.y[index] = (transform.y[index] ?? 0) + Math.sin(heading) * currentSpeed * deltaTime;

      const margin = (morphology.legLength[index] ?? 0) * 1.25;
      const minX = -state.arena.halfWidth + margin;
      const maxX = state.arena.halfWidth - margin;
      const minY = -state.arena.halfHeight + margin;
      const maxY = state.arena.halfHeight - margin;

      if ((transform.x[index] ?? 0) < minX) {
        transform.x[index] = minX;
        transform.targetHeading[index] = Math.PI - heading
          + randomRange(identity.randomState, index, -0.35, 0.35);
      } else if ((transform.x[index] ?? 0) > maxX) {
        transform.x[index] = maxX;
        transform.targetHeading[index] = Math.PI - heading
          + randomRange(identity.randomState, index, -0.35, 0.35);
      }

      if ((transform.y[index] ?? 0) < minY) {
        transform.y[index] = minY;
        transform.targetHeading[index] = -heading
          + randomRange(identity.randomState, index, -0.35, 0.35);
      } else if ((transform.y[index] ?? 0) > maxY) {
        transform.y[index] = maxY;
        transform.targetHeading[index] = -heading
          + randomRange(identity.randomState, index, -0.35, 0.35);
      }
    }
  }
}
