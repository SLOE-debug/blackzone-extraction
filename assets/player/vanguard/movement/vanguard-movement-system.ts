import { type EntitySystem } from '../../../core/entities/entity-system';
import {
  type MutablePlanarPosition,
  type PlanarMovementConstraint,
} from '../../../core/contracts/planar-movement-constraint';
import { dampAngle } from '../../../core/math/scalar';
import { VANGUARD_CONFIG } from '../model/vanguard-config';
import { type VanguardState } from '../model/vanguard-state';

const DIRECTION_EPSILON = 0.0001;

/** 只负责主角在世界 XZ 平面中的加减速、位移和朝向。 */
export class VanguardMovementSystem implements EntitySystem<VanguardState, number> {
  private readonly resolvedPosition: MutablePlanarPosition = { x: 0, z: 0 };

  constructor(private readonly movementConstraint: PlanarMovementConstraint) {}

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

      const startX = transform.x[index] ?? 0;
      const startZ = transform.z[index] ?? 0;
      this.movementConstraint.resolve(
        startX,
        startZ,
        startX + nextVelocityX * deltaTime,
        startZ + nextVelocityZ * deltaTime,
        VANGUARD_CONFIG.collisionRadius,
        this.resolvedPosition,
      );
      const actualVelocityX = (this.resolvedPosition.x - startX) / deltaTime;
      const actualVelocityZ = (this.resolvedPosition.z - startZ) / deltaTime;
      motion.velocityX[index] = actualVelocityX;
      motion.velocityZ[index] = actualVelocityZ;
      motion.speed[index] = Math.hypot(actualVelocityX, actualVelocityZ);
      transform.x[index] = this.resolvedPosition.x;
      transform.z[index] = this.resolvedPosition.z;

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
