import { type EntitySystem } from '../../../core/entities/entity-system';
import { dampAngle } from '../../../core/math/scalar';
import { VANGUARD_CONFIG } from '../model/vanguard-config';
import { type VanguardState } from '../model/vanguard-state';

const DIRECTION_EPSILON = 0.0001;

/** 只负责主角在世界 XZ 平面中的加减速、位移和朝向。 */
export class VanguardMovementSystem implements EntitySystem<VanguardState, number> {
  /** 根据持续控制意图推进单实体运动状态。 */
  public update(state: VanguardState, deltaTime: number): void {
    const { transform, intent, motion } = state.data;
    for (let index = 0; index < state.count; index++) {
      const moveX = intent.moveX[index] ?? 0;
      const moveZ = intent.moveZ[index] ?? 0;
      const targetVelocityX = moveX * VANGUARD_CONFIG.maximumMoveSpeed;
      const targetVelocityZ = moveZ * VANGUARD_CONFIG.maximumMoveSpeed;
      const currentVelocityX = motion.velocityX[index] ?? 0;
      const currentVelocityZ = motion.velocityZ[index] ?? 0;
      const accelerating = targetVelocityX * targetVelocityX + targetVelocityZ * targetVelocityZ
        > currentVelocityX * currentVelocityX + currentVelocityZ * currentVelocityZ;
      const maximumVelocityDelta = (accelerating
        ? VANGUARD_CONFIG.acceleration
        : VANGUARD_CONFIG.deceleration) * deltaTime;
      const velocityDeltaX = targetVelocityX - currentVelocityX;
      const velocityDeltaZ = targetVelocityZ - currentVelocityZ;
      const velocityDeltaLength = Math.hypot(velocityDeltaX, velocityDeltaZ);
      const velocityScale = velocityDeltaLength > maximumVelocityDelta
        && velocityDeltaLength > DIRECTION_EPSILON
        ? maximumVelocityDelta / velocityDeltaLength
        : 1;
      const nextVelocityX = currentVelocityX + velocityDeltaX * velocityScale;
      const nextVelocityZ = currentVelocityZ + velocityDeltaZ * velocityScale;

      motion.velocityX[index] = nextVelocityX;
      motion.velocityZ[index] = nextVelocityZ;
      motion.speed[index] = Math.hypot(nextVelocityX, nextVelocityZ);
      transform.x[index] = (transform.x[index] ?? 0) + nextVelocityX * deltaTime;
      transform.z[index] = (transform.z[index] ?? 0) + nextVelocityZ * deltaTime;

      const aiming = (intent.aiming[index] ?? 0) !== 0;
      const facingX = aiming ? intent.aimX[index] ?? 0 : moveX;
      const facingZ = aiming ? intent.aimZ[index] ?? 0 : moveZ;
      if (facingX * facingX + facingZ * facingZ <= DIRECTION_EPSILON) {
        continue;
      }
      transform.heading[index] = dampAngle(
        transform.heading[index] ?? 0,
        Math.atan2(facingX, facingZ),
        aiming
          ? VANGUARD_CONFIG.aimingTurnSharpness
          : VANGUARD_CONFIG.movementTurnSharpness,
        deltaTime,
      );
    }
  }
}
