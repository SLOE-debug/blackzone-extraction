import { type EntitySystem } from '../../../core/entities/entity-system';
import {
  type MutablePlanarPosition,
  type PlanarMovementConstraint,
} from '../../../core/contracts/planar-movement-constraint';
import { dampAngle, moveAngleTowards } from '../../../core/math/scalar';
import { VANGUARD_CONFIG } from '../model/vanguard-config';
import { VanguardLifePhase } from '../model/vanguard-life';
import { type VanguardState } from '../model/vanguard-state';
import { VanguardFacingPolicy } from '../model/vanguard-facing-policy';

const DIRECTION_EPSILON = 0.0001;

/** 只负责主角在世界 XZ 平面中的加减速、位移和朝向。 */
export class VanguardMovementSystem implements EntitySystem<VanguardState, number> {
  private readonly resolvedPosition: MutablePlanarPosition = { x: 0, z: 0 };

  constructor(private readonly movementConstraint: PlanarMovementConstraint) {}

  /** 根据持续控制意图推进单实体运动状态。 */
  public update(state: VanguardState, deltaTime: number): void {
    const { transform, intent, motion, vitality } = state.data;
    for (let index = 0; index < state.count; index++) {
      if ((vitality.phase[index] as VanguardLifePhase) !== VanguardLifePhase.Alive) {
        motion.velocityX[index] = 0;
        motion.velocityZ[index] = 0;
        motion.speed[index] = 0;
        motion.locomotionForward[index] = 0;
        motion.locomotionRight[index] = 0;
        continue;
      }
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

      const currentHeading = transform.heading[index] ?? 0;
      const facingPolicy = intent.facingPolicy[index] as VanguardFacingPolicy;
      let nextHeading = currentHeading;
      if (facingPolicy === VanguardFacingPolicy.SpinDriven) {
        nextHeading = intent.desiredHeading[index] ?? currentHeading;
      } else if (facingPolicy === VanguardFacingPolicy.SoftTarget
        || facingPolicy === VanguardFacingPolicy.ContactLocked) {
        nextHeading = moveAngleTowards(
          currentHeading,
          intent.desiredHeading[index] ?? currentHeading,
          (intent.maximumTurnSpeed[index] ?? 0) * deltaTime,
        );
      } else {
        const attacking = (intent.attacking[index] ?? 0) !== 0;
        const facingX = attacking ? intent.attackX[index] ?? 0 : moveX;
        const facingZ = attacking ? intent.attackZ[index] ?? 0 : moveZ;
        if (facingX * facingX + facingZ * facingZ > DIRECTION_EPSILON) {
          const targetHeading = Math.atan2(facingX, facingZ);
          const maximumTurnSpeed = intent.maximumTurnSpeed[index] ?? 0;
          nextHeading = maximumTurnSpeed > 0
            ? moveAngleTowards(currentHeading, targetHeading, maximumTurnSpeed * deltaTime)
            : dampAngle(
              currentHeading,
              targetHeading,
              attacking
                ? VANGUARD_CONFIG.attackTurnSharpness
                : VANGUARD_CONFIG.movementTurnSharpness,
              deltaTime,
            );
        }
      }
      transform.heading[index] = nextHeading;
      motion.locomotionForward[index] = actualVelocityX * Math.sin(nextHeading)
        + actualVelocityZ * Math.cos(nextHeading);
      motion.locomotionRight[index] = actualVelocityX * Math.cos(nextHeading)
        - actualVelocityZ * Math.sin(nextHeading);
    }
  }
}
