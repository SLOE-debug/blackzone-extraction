import { type EntitySystem } from '../../../core/entities/entity-system';
import {
  VANGUARD_MANTLE_INVERSE_MASS,
  VANGUARD_MANTLE_PARTICLE_COUNT,
  VANGUARD_MANTLE_PINNED,
  VANGUARD_MANTLE_REST_X,
  VANGUARD_MANTLE_REST_Y,
  VANGUARD_MANTLE_REST_Z,
} from '../model/vanguard-mantle-particles';
import { VANGUARD_ANATOMY } from '../model/vanguard-anatomy';
import {
  VanguardBone,
  VANGUARD_BONE_MATRIX_COMPONENTS,
} from '../model/vanguard-bone';
import {
  type MutableVanguardMantleData,
  writeVanguardMantleRestState,
} from '../model/vanguard-mantle-state';
import { type VanguardState } from '../model/vanguard-state';
import {
  projectVanguardMantleParticleCollision,
  VANGUARD_MANTLE_COLLIDER_COMPONENT_COUNT,
  VanguardMantleColliderComponent,
} from './vanguard-mantle-collision';
import { VANGUARD_MANTLE_CONSTRAINTS } from './vanguard-mantle-constraints';

export const VANGUARD_MANTLE_FIXED_STEP = 1 / 60;
export const VANGUARD_MANTLE_CONSTRAINT_ITERATIONS = 3;

const MAXIMUM_STEPS_PER_FRAME = 3;
const VELOCITY_DAMPING = 0.975;
const LOCAL_GRAVITY = -3.4;
const RESET_DISTANCE_SQUARED = 2.25;
const SCALE_EPSILON = 0.0001;
const CHEST_BIND_FORWARD = 0.012;

/**
 * 在角色本地空间推进固定粒子披风，并用解析身体壳消除穿模。
 */
export class VanguardMantleSimulationSystem implements EntitySystem<VanguardState, number> {
  private readonly anchorX = new Float32Array(VANGUARD_MANTLE_PARTICLE_COUNT);
  private readonly anchorY = new Float32Array(VANGUARD_MANTLE_PARTICLE_COUNT);
  private readonly anchorZ = new Float32Array(VANGUARD_MANTLE_PARTICLE_COUNT);
  private readonly colliders = new Float32Array(VANGUARD_MANTLE_COLLIDER_COMPONENT_COUNT);

  /** 在渲染器创建前写入稳定锚点、碰撞形态和中面法线。 */
  public initialize(state: VanguardState): void {
    for (let entityIndex = 0; entityIndex < state.count; entityIndex++) {
      this.resetEntity(state, entityIndex);
    }
  }

  /** 以固定步长推进全部活动主角披风。 */
  public update(state: VanguardState, deltaTime: number): void {
    if (!Number.isFinite(deltaTime) || deltaTime < 0) {
      throw new Error('主角披风帧时间必须是非负有限数值。');
    }
    for (let entityIndex = 0; entityIndex < state.count; entityIndex++) {
      if ((state.data.mantle.initialized[entityIndex] ?? 0) === 0
        || this.requiresReset(state, entityIndex)) {
        this.resetEntity(state, entityIndex);
        continue;
      }
      this.advanceEntity(state, entityIndex, deltaTime);
    }
  }

  private advanceEntity(
    state: VanguardState,
    entityIndex: number,
    deltaTime: number,
  ): void {
    const mantle = state.data.mantle;
    this.rebaseToCurrentRoot(state, entityIndex);
    this.writeAnchorsAndColliders(state, entityIndex);

    mantle.elapsedTime[entityIndex] = (mantle.elapsedTime[entityIndex] ?? 0) + deltaTime;
    let accumulator = Math.min(
      (mantle.accumulator[entityIndex] ?? 0) + deltaTime,
      VANGUARD_MANTLE_FIXED_STEP * MAXIMUM_STEPS_PER_FRAME,
    );
    let steps = 0;
    while (accumulator >= VANGUARD_MANTLE_FIXED_STEP
      && steps < MAXIMUM_STEPS_PER_FRAME) {
      this.integrate(mantle, entityIndex, mantle.elapsedTime[entityIndex] ?? 0);
      this.solveShapeAndCollisions(mantle, entityIndex);
      accumulator -= VANGUARD_MANTLE_FIXED_STEP;
      steps++;
    }
    mantle.accumulator[entityIndex] = accumulator;
    this.pinParticles(mantle, entityIndex, true);
  }

  private resetEntity(state: VanguardState, entityIndex: number): void {
    const { transform, morphology, mantle } = state.data;
    writeVanguardMantleRestState(
      mantle,
      entityIndex,
      transform.x[entityIndex] ?? 0,
      transform.y[entityIndex] ?? 0,
      transform.z[entityIndex] ?? 0,
      transform.heading[entityIndex] ?? 0,
      morphology.scale[entityIndex] ?? 1,
    );
    this.writeAnchorsAndColliders(state, entityIndex);
    this.pinParticles(mantle, entityIndex, true);
    for (let iteration = 0; iteration < VANGUARD_MANTLE_CONSTRAINT_ITERATIONS; iteration++) {
      this.solveConstraints(mantle, entityIndex);
      this.pinParticles(mantle, entityIndex, false);
      this.projectCollisions(mantle, entityIndex);
    }
    this.pinParticles(mantle, entityIndex, true);
    mantle.initialized[entityIndex] = 1;
  }

  private integrate(
    mantle: MutableVanguardMantleData,
    entityIndex: number,
    elapsedTime: number,
  ): void {
    const particleOffset = entityIndex * VANGUARD_MANTLE_PARTICLE_COUNT;
    const stepSquared = VANGUARD_MANTLE_FIXED_STEP * VANGUARD_MANTLE_FIXED_STEP;
    for (let particle = 0; particle < VANGUARD_MANTLE_PARTICLE_COUNT; particle++) {
      if ((VANGUARD_MANTLE_PINNED[particle] ?? 0) !== 0) {
        continue;
      }
      const target = particleOffset + particle;
      const currentX = mantle.positionX[target] ?? 0;
      const currentY = mantle.positionY[target] ?? 0;
      const currentZ = mantle.positionZ[target] ?? 0;
      const inverseMass = VANGUARD_MANTLE_INVERSE_MASS[particle] ?? 1;
      const windX = (Math.sin(elapsedTime * 1.31 + particle * 0.77) * 0.55
        + Math.sin(elapsedTime * 0.47 + particle * 0.19) * 0.24) * inverseMass;
      const windZ = (Math.sin(elapsedTime * 1.83 + particle * 0.61) * 1.45
        + Math.cos(elapsedTime * 0.69 - particle * 0.37) * 0.62) * inverseMass;
      mantle.positionX[target] = currentX
        + (currentX - (mantle.previousX[target] ?? currentX)) * VELOCITY_DAMPING
        + windX * stepSquared;
      mantle.positionY[target] = currentY
        + (currentY - (mantle.previousY[target] ?? currentY)) * VELOCITY_DAMPING
        + LOCAL_GRAVITY * stepSquared;
      mantle.positionZ[target] = currentZ
        + (currentZ - (mantle.previousZ[target] ?? currentZ)) * VELOCITY_DAMPING
        + windZ * stepSquared;
      mantle.previousX[target] = currentX;
      mantle.previousY[target] = currentY;
      mantle.previousZ[target] = currentZ;
    }
  }

  private solveShapeAndCollisions(
    mantle: MutableVanguardMantleData,
    entityIndex: number,
  ): void {
    for (let iteration = 0; iteration < VANGUARD_MANTLE_CONSTRAINT_ITERATIONS; iteration++) {
      this.solveConstraints(mantle, entityIndex);
      this.pinParticles(mantle, entityIndex, false);
      this.projectCollisions(mantle, entityIndex);
    }
    this.projectCollisions(mantle, entityIndex);
    this.pinParticles(mantle, entityIndex, false);
  }

  private solveConstraints(
    mantle: MutableVanguardMantleData,
    entityIndex: number,
  ): void {
    const particleOffset = entityIndex * VANGUARD_MANTLE_PARTICLE_COUNT;
    const constraints = VANGUARD_MANTLE_CONSTRAINTS;
    for (let constraint = 0; constraint < constraints.particleA.length; constraint++) {
      const localA = constraints.particleA[constraint] ?? 0;
      const localB = constraints.particleB[constraint] ?? 0;
      const weightA = VANGUARD_MANTLE_INVERSE_MASS[localA] ?? 0;
      const weightB = VANGUARD_MANTLE_INVERSE_MASS[localB] ?? 0;
      const weightSum = weightA + weightB;
      if (weightSum <= 0) {
        continue;
      }
      const a = particleOffset + localA;
      const b = particleOffset + localB;
      const deltaX = (mantle.positionX[b] ?? 0) - (mantle.positionX[a] ?? 0);
      const deltaY = (mantle.positionY[b] ?? 0) - (mantle.positionY[a] ?? 0);
      const deltaZ = (mantle.positionZ[b] ?? 0) - (mantle.positionZ[a] ?? 0);
      const length = Math.max(Math.hypot(deltaX, deltaY, deltaZ), 0.000001);
      const correction = (length - (constraints.restLength[constraint] ?? length))
        / length
        * (constraints.stiffness[constraint] ?? 1)
        / weightSum;
      mantle.positionX[a] = (mantle.positionX[a] ?? 0) + deltaX * correction * weightA;
      mantle.positionY[a] = (mantle.positionY[a] ?? 0) + deltaY * correction * weightA;
      mantle.positionZ[a] = (mantle.positionZ[a] ?? 0) + deltaZ * correction * weightA;
      mantle.positionX[b] = (mantle.positionX[b] ?? 0) - deltaX * correction * weightB;
      mantle.positionY[b] = (mantle.positionY[b] ?? 0) - deltaY * correction * weightB;
      mantle.positionZ[b] = (mantle.positionZ[b] ?? 0) - deltaZ * correction * weightB;
    }
  }

  private projectCollisions(
    mantle: MutableVanguardMantleData,
    entityIndex: number,
  ): void {
    const particleOffset = entityIndex * VANGUARD_MANTLE_PARTICLE_COUNT;
    for (let particle = 0; particle < VANGUARD_MANTLE_PARTICLE_COUNT; particle++) {
      if ((VANGUARD_MANTLE_PINNED[particle] ?? 0) === 0) {
        projectVanguardMantleParticleCollision(
          mantle,
          particleOffset,
          particle,
          this.colliders,
        );
      }
    }
  }

  private pinParticles(
    mantle: MutableVanguardMantleData,
    entityIndex: number,
    includePrevious: boolean,
  ): void {
    const particleOffset = entityIndex * VANGUARD_MANTLE_PARTICLE_COUNT;
    for (let particle = 0; particle < VANGUARD_MANTLE_PARTICLE_COUNT; particle++) {
      if ((VANGUARD_MANTLE_PINNED[particle] ?? 0) === 0) {
        continue;
      }
      const target = particleOffset + particle;
      mantle.positionX[target] = this.anchorX[particle] ?? 0;
      mantle.positionY[target] = this.anchorY[particle] ?? 0;
      mantle.positionZ[target] = this.anchorZ[particle] ?? 0;
      if (includePrevious) {
        mantle.previousX[target] = mantle.positionX[target] ?? 0;
        mantle.previousY[target] = mantle.positionY[target] ?? 0;
        mantle.previousZ[target] = mantle.positionZ[target] ?? 0;
      }
    }
  }

  private requiresReset(state: VanguardState, entityIndex: number): boolean {
    const { transform, morphology, mantle } = state.data;
    const deltaX = (transform.x[entityIndex] ?? 0) - (mantle.rootX[entityIndex] ?? 0);
    const deltaY = (transform.y[entityIndex] ?? 0) - (mantle.rootY[entityIndex] ?? 0);
    const deltaZ = (transform.z[entityIndex] ?? 0) - (mantle.rootZ[entityIndex] ?? 0);
    return deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ > RESET_DISTANCE_SQUARED
      || Math.abs((morphology.scale[entityIndex] ?? 1) - (mantle.rootScale[entityIndex] ?? 1))
        > SCALE_EPSILON;
  }

  private rebaseToCurrentRoot(state: VanguardState, entityIndex: number): void {
    const { transform, morphology, mantle } = state.data;
    const oldRootX = mantle.rootX[entityIndex] ?? 0;
    const oldRootY = mantle.rootY[entityIndex] ?? 0;
    const oldRootZ = mantle.rootZ[entityIndex] ?? 0;
    const oldHeading = mantle.rootHeading[entityIndex] ?? 0;
    const oldScale = mantle.rootScale[entityIndex] ?? 1;
    const rootX = transform.x[entityIndex] ?? 0;
    const rootY = transform.y[entityIndex] ?? 0;
    const rootZ = transform.z[entityIndex] ?? 0;
    const heading = transform.heading[entityIndex] ?? 0;
    const scale = morphology.scale[entityIndex] ?? 1;
    const headingCosine = Math.cos(heading);
    const headingSine = Math.sin(heading);
    const deltaCosine = Math.cos(oldHeading - heading);
    const deltaSine = Math.sin(oldHeading - heading);
    const inverseScale = 1 / Math.max(scale, 0.000001);
    const scaleRatio = oldScale * inverseScale;
    const translationWorldX = oldRootX - rootX;
    const translationWorldZ = oldRootZ - rootZ;
    const translationX = (translationWorldX * headingCosine
      - translationWorldZ * headingSine) * inverseScale;
    const translationY = (oldRootY - rootY) * inverseScale;
    const translationZ = (translationWorldX * headingSine
      + translationWorldZ * headingCosine) * inverseScale;
    const particleOffset = entityIndex * VANGUARD_MANTLE_PARTICLE_COUNT;
    for (let particle = 0; particle < VANGUARD_MANTLE_PARTICLE_COUNT; particle++) {
      const target = particleOffset + particle;
      const currentX = mantle.positionX[target] ?? 0;
      const currentZ = mantle.positionZ[target] ?? 0;
      const previousX = mantle.previousX[target] ?? 0;
      const previousZ = mantle.previousZ[target] ?? 0;
      mantle.positionX[target] = translationX
        + (currentX * deltaCosine + currentZ * deltaSine) * scaleRatio;
      mantle.positionY[target] = translationY + (mantle.positionY[target] ?? 0) * scaleRatio;
      mantle.positionZ[target] = translationZ
        + (-currentX * deltaSine + currentZ * deltaCosine) * scaleRatio;
      mantle.previousX[target] = translationX
        + (previousX * deltaCosine + previousZ * deltaSine) * scaleRatio;
      mantle.previousY[target] = translationY + (mantle.previousY[target] ?? 0) * scaleRatio;
      mantle.previousZ[target] = translationZ
        + (-previousX * deltaSine + previousZ * deltaCosine) * scaleRatio;
    }
    mantle.rootX[entityIndex] = rootX;
    mantle.rootY[entityIndex] = rootY;
    mantle.rootZ[entityIndex] = rootZ;
    mantle.rootHeading[entityIndex] = heading;
    mantle.rootScale[entityIndex] = scale;
  }

  private writeAnchorsAndColliders(state: VanguardState, entityIndex: number): void {
    const matrices = state.data.pose.boneMatrices;
    const entityMatrixOffset = entityIndex
      * VanguardBone.Count
      * VANGUARD_BONE_MATRIX_COMPONENTS;
    const chestOffset = entityMatrixOffset + VanguardBone.Chest * VANGUARD_BONE_MATRIX_COMPONENTS;
    for (let particle = 0; particle < VANGUARD_MANTLE_PARTICLE_COUNT; particle++) {
      if ((VANGUARD_MANTLE_PINNED[particle] ?? 0) === 0) {
        continue;
      }
      const localX = VANGUARD_MANTLE_REST_X[particle] ?? 0;
      const localY = (VANGUARD_MANTLE_REST_Y[particle] ?? 0) - VANGUARD_ANATOMY.chestY;
      const localZ = (VANGUARD_MANTLE_REST_Z[particle] ?? 0) - CHEST_BIND_FORWARD;
      const worldX = (matrices[chestOffset + 9] ?? 0)
        + (matrices[chestOffset] ?? 0) * localX
        + (matrices[chestOffset + 3] ?? 0) * localY
        + (matrices[chestOffset + 6] ?? 0) * localZ;
      const worldY = (matrices[chestOffset + 10] ?? 0)
        + (matrices[chestOffset + 1] ?? 0) * localX
        + (matrices[chestOffset + 4] ?? 0) * localY
        + (matrices[chestOffset + 7] ?? 0) * localZ;
      const worldZ = (matrices[chestOffset + 11] ?? 0)
        + (matrices[chestOffset + 2] ?? 0) * localX
        + (matrices[chestOffset + 5] ?? 0) * localY
        + (matrices[chestOffset + 8] ?? 0) * localZ;
      this.writeWorldPointToRootLocal(
        state,
        entityIndex,
        worldX,
        worldY,
        worldZ,
        this.anchorX,
        this.anchorY,
        this.anchorZ,
        particle,
      );
    }
    this.writeBoneOriginToCollider(state, entityIndex, VanguardBone.Chest,
      VanguardMantleColliderComponent.TorsoX);
    this.writeBoneOriginToCollider(state, entityIndex, VanguardBone.LeftUpperArm,
      VanguardMantleColliderComponent.LeftShoulderX);
    this.writeBoneOriginToCollider(state, entityIndex, VanguardBone.LeftForearm,
      VanguardMantleColliderComponent.LeftElbowX);
    this.writeBoneOriginToCollider(state, entityIndex, VanguardBone.LeftHand,
      VanguardMantleColliderComponent.LeftWristX);
    this.writeBoneOriginToCollider(state, entityIndex, VanguardBone.RightUpperArm,
      VanguardMantleColliderComponent.RightShoulderX);
    this.writeBoneOriginToCollider(state, entityIndex, VanguardBone.RightForearm,
      VanguardMantleColliderComponent.RightElbowX);
    this.writeBoneOriginToCollider(state, entityIndex, VanguardBone.RightHand,
      VanguardMantleColliderComponent.RightWristX);
  }

  private writeBoneOriginToCollider(
    state: VanguardState,
    entityIndex: number,
    bone: VanguardBone,
    target: VanguardMantleColliderComponent,
  ): void {
    const matrixOffset = (entityIndex * VanguardBone.Count + bone)
      * VANGUARD_BONE_MATRIX_COMPONENTS;
    const matrices = state.data.pose.boneMatrices;
    const { transform, morphology } = state.data;
    const heading = transform.heading[entityIndex] ?? 0;
    const headingCosine = Math.cos(heading);
    const headingSine = Math.sin(heading);
    const inverseScale = 1 / Math.max(morphology.scale[entityIndex] ?? 1, 0.000001);
    const deltaX = (matrices[matrixOffset + 9] ?? 0) - (transform.x[entityIndex] ?? 0);
    const deltaZ = (matrices[matrixOffset + 11] ?? 0) - (transform.z[entityIndex] ?? 0);
    this.colliders[target] = (deltaX * headingCosine - deltaZ * headingSine) * inverseScale;
    this.colliders[target + 1] = ((matrices[matrixOffset + 10] ?? 0)
      - (transform.y[entityIndex] ?? 0)) * inverseScale;
    this.colliders[target + 2] = (deltaX * headingSine + deltaZ * headingCosine) * inverseScale;
  }

  private writeWorldPointToRootLocal(
    state: VanguardState,
    entityIndex: number,
    worldX: number,
    worldY: number,
    worldZ: number,
    targetX: Float32Array,
    targetY: Float32Array,
    targetZ: Float32Array,
    target: number,
  ): void {
    const { transform, morphology } = state.data;
    const heading = transform.heading[entityIndex] ?? 0;
    const headingCosine = Math.cos(heading);
    const headingSine = Math.sin(heading);
    const inverseScale = 1 / Math.max(morphology.scale[entityIndex] ?? 1, 0.000001);
    const deltaX = worldX - (transform.x[entityIndex] ?? 0);
    const deltaZ = worldZ - (transform.z[entityIndex] ?? 0);
    targetX[target] = (deltaX * headingCosine - deltaZ * headingSine) * inverseScale;
    targetY[target] = (worldY - (transform.y[entityIndex] ?? 0)) * inverseScale;
    targetZ[target] = (deltaX * headingSine + deltaZ * headingCosine) * inverseScale;
  }
}
