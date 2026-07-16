import { type EntitySystem } from '../../../../../core/entities/entity-system';
import { damp, TAU, wrapAngle } from '../../../../../core/math/scalar';
import { randomRange } from '../../../../../core/math/xorshift32';
import { CurveCrawlerLifePhase } from '../model/curve-crawler-life';
import { CurveCrawlerMotionProfile } from '../model/curve-crawler-motion-profile';
import { type CurveCrawlerState } from '../model/curve-crawler-state';

/** 负责存活实体的步态、姿态混合、身体脉动和眨眼。 */
export class CurveCrawlerAnimationSystem implements EntitySystem<CurveCrawlerState, number> {
  /** 推进全部实体的动画状态。 */
  public update(state: CurveCrawlerState, deltaTime: number): void {
    const { identity, morphology, vitality, intent, motion, animation } = state.data;

    for (let index = 0; index < state.count; index++) {
      const lifePhase = vitality.phase[index] as CurveCrawlerLifePhase;
      if (lifePhase !== CurveCrawlerLifePhase.Alive) {
        continue;
      }
      const crouchAmount = damp(
        animation.crouchAmount[index] ?? 0,
        intent.targetCrouch[index] ?? 0,
        7,
        deltaTime,
      );
      const waveAmount = damp(
        animation.waveAmount[index] ?? 0,
        intent.targetWave[index] ?? 0,
        8,
        deltaTime,
      );
      const turnAmount = damp(
        animation.turnAmount[index] ?? 0,
        intent.targetTurn[index] ?? 0,
        6.5,
        deltaTime,
      );
      const currentSpeed = motion.currentSpeed[index] ?? 0;
      const cruiseSpeed = morphology.cruiseSpeed[index] ?? 0.01;
      const phaseRate = state.motionProfile === CurveCrawlerMotionProfile.ObservationDisplay
        ? getObservationPhaseRate(
          currentSpeed,
          morphology.legLength[index] ?? 0,
          intent.gaitMultiplier[index] ?? 1,
        ) * (intent.gaitDirection[index] ?? 1)
        : (2.3 + currentSpeed * 0.24) * (intent.gaitMultiplier[index] ?? 1);
      const phase = wrapAngle(
        (animation.phase[index] ?? 0)
        + deltaTime * phaseRate,
      );

      animation.crouchAmount[index] = crouchAmount;
      animation.waveAmount[index] = waveAmount;
      animation.turnAmount[index] = turnAmount;
      if ((intent.targetTurn[index] ?? 0) > 0.001) {
        animation.turnDirection[index] = intent.turnDirection[index] ?? 1;
      }
      animation.phase[index] = phase;
      animation.wavePhase[index] = wrapAngle((animation.wavePhase[index] ?? 0) + deltaTime * 7.5);
      animation.nextBlinkTime[index] = (animation.nextBlinkTime[index] ?? 0) - deltaTime;

      if ((animation.nextBlinkTime[index] ?? 0) <= 0 && (animation.blinkTime[index] ?? 0) <= 0) {
        animation.blinkTime[index] = randomRange(identity.randomState, index, 0.11, 0.2);
        animation.nextBlinkTime[index] = randomRange(identity.randomState, index, 2.2, 7.5);
      }

      if ((animation.blinkTime[index] ?? 0) > 0) {
        animation.blinkTime[index] = (animation.blinkTime[index] ?? 0) - deltaTime;
        const normalized = Math.max(0, (animation.blinkTime[index] ?? 0) / 0.2);
        animation.blinkScale[index] = 0.15 + Math.abs(normalized * 2 - 1) * 0.85;
      } else {
        animation.blinkScale[index] = damp(animation.blinkScale[index] ?? 1, 1, 18, deltaTime);
      }

      const speedRatio = Math.min(currentSpeed / Math.max(cruiseSpeed, 0.01), 2.5);
      animation.bodyPulse[index] = Math.sin(phase * 2 + index * 0.17)
        * (0.018 + speedRatio * 0.018);
    }
  }
}

/** 让观察展示步态严格按照根节点实际走过的距离推进。 */
function getObservationPhaseRate(
  currentSpeed: number,
  legLength: number,
  gaitMultiplier: number,
): number {
  if (currentSpeed < 0.025) {
    return 0;
  }
  const strideDistance = Math.max(legLength * 0.36, 0.01);
  return currentSpeed / strideDistance * TAU * gaitMultiplier;
}
