import { MonsterLifecycleState } from '../../../../../core/contracts/monster-lifecycle';
import { type EntitySystem } from '../../../../../core/entities/entity-system';
import {
  getVenomLobberLegJointIndex,
  isVenomLobberTripodA,
  VENOM_LOBBER_LEG_COUNT,
  VENOM_LOBBER_LEG_JOINT_COUNT,
  VENOM_LOBBER_LEG_PATHS,
} from '../model/venom-lobber-leg-rig';
import { type VenomLobberState } from '../model/venom-lobber-state';

const TAU = Math.PI * 2;
const SWING_PORTION = 0.4;
const MOVEMENT_EPSILON = 0.03;

/** 规划六足落点、锁定支撑脚并把解析 IK 结果写入连续关节流。 */
export class VenomLobberLegAnimationSystem
implements EntitySystem<VenomLobberState, number> {
  public update(state: VenomLobberState, deltaTime: number): void {
    const { transform, morphology, vitality, motion, animation } = state.data;
    for (let entityIndex = 0; entityIndex < state.count; entityIndex++) {
      const lifecycle = vitality.state[entityIndex] as MonsterLifecycleState;
      const scale = morphology.scale[entityIndex] ?? 1;
      if (lifecycle === MonsterLifecycleState.Spawning) {
        animation.legPoseInitialized[entityIndex] = 0;
        this.writeLifecyclePose(state, entityIndex, lifecycle);
        continue;
      }
      if (lifecycle === MonsterLifecycleState.Dying
        || lifecycle === MonsterLifecycleState.Despawning) {
        animation.legPoseInitialized[entityIndex] = 0;
        this.writeLifecyclePose(state, entityIndex, lifecycle);
        continue;
      }
      if (lifecycle !== MonsterLifecycleState.Alive) {
        animation.legPoseInitialized[entityIndex] = 0;
        continue;
      }
      const heading = transform.heading[entityIndex] ?? 0;
      const headingCosine = Math.cos(heading);
      const headingSine = Math.sin(heading);
      const rootX = transform.x[entityIndex] ?? 0;
      const rootY = transform.y[entityIndex] ?? 0;
      if ((animation.legPoseInitialized[entityIndex] ?? 0) === 0) {
        initializeFootAnchors(
          state,
          entityIndex,
          rootX,
          rootY,
          headingCosine,
          headingSine,
          scale,
        );
      }
      const speed = Math.abs(motion.currentSpeed[entityIndex] ?? 0);
      const footBase = entityIndex * VENOM_LOBBER_LEG_COUNT;
      let completingSwing = false;
      for (let legId = 0; legId < VENOM_LOBBER_LEG_COUNT; legId++) {
        completingSwing ||= (animation.legSwinging[footBase + legId] ?? 0) !== 0;
      }
      let phase = animation.gaitPhase[entityIndex] ?? 0;
      if (speed > MOVEMENT_EPSILON || completingSwing) {
        phase = (phase + deltaTime * (1.4 + speed * 0.32)) % TAU;
        animation.gaitPhase[entityIndex] = phase;
      }
      const speedRatio = Math.min(
        1,
        speed / Math.max(morphology.cruiseSpeed[entityIndex] ?? 1, 0.01),
      );
      const bodyBob = Math.sin(phase * 2) * Math.min(0.28, speed * 0.025);
      const phaseCycle = phase / TAU;
      for (let legId = 0; legId < VENOM_LOBBER_LEG_COUNT; legId++) {
        const footOffset = footBase + legId;
        const cycle = (phaseCycle + (isVenomLobberTripodA(legId) ? 0 : 0.5)) % 1;
        const wasSwinging = (animation.legSwinging[footOffset] ?? 0) !== 0;
        const swinging = cycle < SWING_PORTION
          && (speed > MOVEMENT_EPSILON || wasSwinging);
        let footWorldX = animation.footAnchorX[footOffset] ?? rootX;
        let footWorldY = animation.footAnchorY[footOffset] ?? rootY;
        let lift = 0;
        if (swinging) {
          if (!wasSwinging) {
            animation.swingStartX[footOffset] = footWorldX;
            animation.swingStartY[footOffset] = footWorldY;
            const restFoot = VENOM_LOBBER_LEG_PATHS[legId]?.[3];
            if (restFoot === undefined) {
              throw new Error('Venom Lobber 腿部静止脚点缺失。');
            }
            const stride = Math.min(1.6, speed * 0.22);
            animation.swingTargetX[footOffset] = rootX
              + (restFoot[0] * headingCosine - restFoot[1] * headingSine) * scale
              + headingCosine * stride;
            animation.swingTargetY[footOffset] = rootY
              + (restFoot[0] * headingSine + restFoot[1] * headingCosine) * scale
              + headingSine * stride;
            animation.legSwinging[footOffset] = 1;
          }
          const progress = smoothStep(cycle / SWING_PORTION);
          footWorldX = lerp(
            animation.swingStartX[footOffset] ?? footWorldX,
            animation.swingTargetX[footOffset] ?? footWorldX,
            progress,
          );
          footWorldY = lerp(
            animation.swingStartY[footOffset] ?? footWorldY,
            animation.swingTargetY[footOffset] ?? footWorldY,
            progress,
          );
          animation.footAnchorX[footOffset] = footWorldX;
          animation.footAnchorY[footOffset] = footWorldY;
          lift = Math.sin(progress * Math.PI) * (0.72 + speedRatio * 0.3);
        } else if (wasSwinging) {
          footWorldX = animation.swingTargetX[footOffset] ?? footWorldX;
          footWorldY = animation.swingTargetY[footOffset] ?? footWorldY;
          animation.footAnchorX[footOffset] = footWorldX;
          animation.footAnchorY[footOffset] = footWorldY;
          animation.legSwinging[footOffset] = 0;
        }
        const deltaX = (footWorldX - rootX) / scale;
        const deltaY = (footWorldY - rootY) / scale;
        const localX = deltaX * headingCosine + deltaY * headingSine;
        const localY = -deltaX * headingSine + deltaY * headingCosine;
        const restFootZ = VENOM_LOBBER_LEG_PATHS[legId]?.[3]?.[2] ?? 0.14;
        solveLeg(state, entityIndex, legId, localX, localY, restFootZ + lift - bodyBob);
      }
    }
  }

  /** 只消费统一生命周期腿部进度，按前、中、后顺序展开或失力。 */
  private writeLifecyclePose(
    state: VenomLobberState,
    entityIndex: number,
    lifecycle: MonsterLifecycleState,
  ): void {
    const animation = state.data.animation;
    const masterProgress = clamp01(animation.lifecycleLegProgress[entityIndex] ?? 0);
    const spawning = lifecycle === MonsterLifecycleState.Spawning;
    const rootElevation = animation.rootElevation[entityIndex] ?? 0;
    const bodyCompression = animation.bodyCompression[entityIndex] ?? 1;
    for (let legId = 0; legId < VENOM_LOBBER_LEG_COUNT; legId++) {
      const path = VENOM_LOBBER_LEG_PATHS[legId];
      if (path === undefined) {
        continue;
      }
      const longitudinalGroup = legId % 3;
      const staggerOffset = (spawning ? longitudinalGroup : 2 - longitudinalGroup) * 0.17;
      const extendedProgress = smoothStep(clamp01(
        (masterProgress - staggerOffset) / 0.66,
      ));
      const root = path[0];
      const foot = path[3];
      solveLeg(
        state,
        entityIndex,
        legId,
        lerp(root[0], foot[0], extendedProgress),
        lerp(root[1] * 0.35, foot[1], extendedProgress),
        lerp(
          root[2] * bodyCompression,
          foot[2] - rootElevation,
          extendedProgress,
        ),
        root[2] * bodyCompression,
      );
    }
  }
}

function initializeFootAnchors(
  state: VenomLobberState,
  entityIndex: number,
  rootX: number,
  rootY: number,
  headingCosine: number,
  headingSine: number,
  scale: number,
): void {
  const animation = state.data.animation;
  const footBase = entityIndex * VENOM_LOBBER_LEG_COUNT;
  for (let legId = 0; legId < VENOM_LOBBER_LEG_COUNT; legId++) {
    const foot = VENOM_LOBBER_LEG_PATHS[legId]?.[3];
    if (foot === undefined) {
      continue;
    }
    const offset = footBase + legId;
    animation.footAnchorX[offset] = rootX
      + (foot[0] * headingCosine - foot[1] * headingSine) * scale;
    animation.footAnchorY[offset] = rootY
      + (foot[0] * headingSine + foot[1] * headingCosine) * scale;
    animation.legSwinging[offset] = 0;
    solveLeg(state, entityIndex, legId, foot[0], foot[1], foot[2]);
  }
  animation.legPoseInitialized[entityIndex] = 1;
}

/** 使用 Coxa 水平转向和 Femur/Tibia 二连杆解析解写出四个关节。 */
function solveLeg(
  state: VenomLobberState,
  entityIndex: number,
  legId: number,
  targetX: number,
  targetY: number,
  targetZ: number,
  rootZOverride?: number,
): void {
  const path = VENOM_LOBBER_LEG_PATHS[legId];
  if (path === undefined) {
    return;
  }
  const root = path[0];
  const coxaRest = path[1];
  const kneeRest = path[2];
  const footRest = path[3];
  const rootZ = rootZOverride ?? root[2];
  const directionX = targetX - root[0];
  const directionY = targetY - root[1];
  const inverseDirection = 1 / Math.max(Math.hypot(directionX, directionY), 0.0001);
  const planarX = directionX * inverseDirection;
  const planarY = directionY * inverseDirection;
  const coxaLength = Math.hypot(
    coxaRest[0] - root[0],
    coxaRest[1] - root[1],
  );
  const coxaX = root[0] + planarX * coxaLength;
  const coxaY = root[1] + planarY * coxaLength;
  const coxaZ = coxaRest[2] + rootZ - root[2];
  const remainingHorizontal = Math.max(
    0.0001,
    Math.hypot(targetX - coxaX, targetY - coxaY),
  );
  const remainingVertical = targetZ - coxaZ;
  const upperLength = distance(coxaRest, kneeRest);
  const lowerLength = distance(kneeRest, footRest);
  const rawDistance = Math.hypot(remainingHorizontal, remainingVertical);
  const solvedDistance = Math.max(
    Math.abs(upperLength - lowerLength) + 0.02,
    Math.min(rawDistance, upperLength + lowerLength - 0.02),
  );
  const distanceScale = solvedDistance / Math.max(rawDistance, 0.0001);
  const solvedHorizontal = remainingHorizontal * distanceScale;
  const solvedVertical = remainingVertical * distanceScale;
  const baseAngle = Math.atan2(solvedVertical, solvedHorizontal);
  const shoulderOffset = Math.acos(clamp(
    (upperLength * upperLength + solvedDistance * solvedDistance - lowerLength * lowerLength)
      / (2 * upperLength * solvedDistance),
    -1,
    1,
  ));
  const shoulderAngle = baseAngle + shoulderOffset;
  const kneeX = coxaX + planarX * Math.cos(shoulderAngle) * upperLength;
  const kneeY = coxaY + planarY * Math.cos(shoulderAngle) * upperLength;
  const kneeZ = coxaZ + Math.sin(shoulderAngle) * upperLength;
  const footX = coxaX + planarX * solvedHorizontal;
  const footY = coxaY + planarY * solvedHorizontal;
  const footZ = coxaZ + solvedVertical;
  writeJoint(state, entityIndex, legId, 0, root[0], root[1], rootZ);
  writeJoint(state, entityIndex, legId, 1, coxaX, coxaY, coxaZ);
  writeJoint(state, entityIndex, legId, 2, kneeX, kneeY, kneeZ);
  writeJoint(state, entityIndex, legId, 3, footX, footY, footZ);
}

function writeJoint(
  state: VenomLobberState,
  entityIndex: number,
  legId: number,
  jointId: number,
  x: number,
  y: number,
  z: number,
): void {
  const entityOffset = entityIndex * VENOM_LOBBER_LEG_COUNT
    * VENOM_LOBBER_LEG_JOINT_COUNT;
  const offset = entityOffset + getVenomLobberLegJointIndex(legId, jointId);
  state.data.animation.legJointX[offset] = x;
  state.data.animation.legJointY[offset] = y;
  state.data.animation.legJointZ[offset] = z;
}

function distance(first: readonly number[], second: readonly number[]): number {
  return Math.hypot(
    (second[0] ?? 0) - (first[0] ?? 0),
    (second[1] ?? 0) - (first[1] ?? 0),
    (second[2] ?? 0) - (first[2] ?? 0),
  );
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(value, maximum));
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

function lerp(start: number, end: number, progress: number): number {
  return start + (end - start) * progress;
}

function smoothStep(value: number): number {
  return value * value * (3 - value * 2);
}
