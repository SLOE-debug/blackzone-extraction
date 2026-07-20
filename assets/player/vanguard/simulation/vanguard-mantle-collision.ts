import { VANGUARD_MANTLE_BACKSTOP_Z } from '../model/vanguard-mantle-particles';
import { type MutableVanguardMantleData } from '../model/vanguard-mantle-state';
import {
  resolveVanguardDepthRadius,
  VANGUARD_TORSO_COLLISION_DEPTH_RADIUS,
} from '../model/vanguard-depth-profile';

export const VANGUARD_MANTLE_COLLIDER_COMPONENT_COUNT = 21;

const LEFT_UPPER_ARM_DEPTH_RADIUS = resolveVanguardDepthRadius(2.45, 0.205);
const LEFT_FOREARM_DEPTH_RADIUS = resolveVanguardDepthRadius(1.84, 0.15);
const RIGHT_UPPER_ARM_DEPTH_RADIUS = resolveVanguardDepthRadius(2.45, 0.2);
const RIGHT_FOREARM_DEPTH_RADIUS = resolveVanguardDepthRadius(1.84, 0.145);

export const enum VanguardMantleColliderComponent {
  TorsoX,
  TorsoY,
  TorsoZ,
  LeftShoulderX,
  LeftShoulderY,
  LeftShoulderZ,
  LeftElbowX,
  LeftElbowY,
  LeftElbowZ,
  LeftWristX,
  LeftWristY,
  LeftWristZ,
  RightShoulderX,
  RightShoulderY,
  RightShoulderZ,
  RightElbowX,
  RightElbowY,
  RightElbowZ,
  RightWristX,
  RightWristY,
  RightWristZ,
}

/** 把一个自由粒子投影到躯干椭球、双臂胶囊和逐点背挡之外。 */
export function projectVanguardMantleParticleCollision(
  mantle: MutableVanguardMantleData,
  particleOffset: number,
  particle: number,
  colliders: Float32Array,
): void {
  const target = particleOffset + particle;
  mantle.positionZ[target] = Math.max(
    mantle.positionZ[target] ?? 0,
    VANGUARD_MANTLE_BACKSTOP_Z[particle] ?? -1,
  );
  for (let pass = 0; pass < 2; pass++) {
    projectEllipsoid(mantle, target, colliders);
    projectCapsule(mantle, target, colliders,
      VanguardMantleColliderComponent.LeftShoulderX,
      VanguardMantleColliderComponent.LeftElbowX,
      0.205,
      LEFT_UPPER_ARM_DEPTH_RADIUS);
    projectCapsule(mantle, target, colliders,
      VanguardMantleColliderComponent.LeftElbowX,
      VanguardMantleColliderComponent.LeftWristX,
      0.15,
      LEFT_FOREARM_DEPTH_RADIUS);
    projectCapsule(mantle, target, colliders,
      VanguardMantleColliderComponent.RightShoulderX,
      VanguardMantleColliderComponent.RightElbowX,
      0.2,
      RIGHT_UPPER_ARM_DEPTH_RADIUS);
    projectCapsule(mantle, target, colliders,
      VanguardMantleColliderComponent.RightElbowX,
      VanguardMantleColliderComponent.RightWristX,
      0.145,
      RIGHT_FOREARM_DEPTH_RADIUS);
  }
  projectEllipsoid(mantle, target, colliders);
  mantle.positionZ[target] = Math.max(
    mantle.positionZ[target] ?? 0,
    VANGUARD_MANTLE_BACKSTOP_Z[particle] ?? -1,
  );
}

function projectEllipsoid(
  mantle: MutableVanguardMantleData,
  target: number,
  colliders: Float32Array,
): void {
  const radiusX = 0.62;
  const radiusY = 0.79;
  const radiusZ = VANGUARD_TORSO_COLLISION_DEPTH_RADIUS;
  let deltaX = (mantle.positionX[target] ?? 0)
    - (colliders[VanguardMantleColliderComponent.TorsoX] ?? 0);
  let deltaY = (mantle.positionY[target] ?? 0)
    - (colliders[VanguardMantleColliderComponent.TorsoY] ?? 0);
  let deltaZ = (mantle.positionZ[target] ?? 0)
    - (colliders[VanguardMantleColliderComponent.TorsoZ] ?? 0);
  const scaledLengthSquared = deltaX * deltaX / (radiusX * radiusX)
    + deltaY * deltaY / (radiusY * radiusY)
    + deltaZ * deltaZ / (radiusZ * radiusZ);
  if (scaledLengthSquared >= 1) {
    return;
  }
  if (scaledLengthSquared <= 0.000001) {
    deltaX = 0;
    deltaY = 0;
    deltaZ = radiusZ;
  } else {
    const scale = 1 / Math.sqrt(scaledLengthSquared);
    deltaX *= scale;
    deltaY *= scale;
    deltaZ *= scale;
  }
  mantle.positionX[target] = (colliders[VanguardMantleColliderComponent.TorsoX] ?? 0) + deltaX;
  mantle.positionY[target] = (colliders[VanguardMantleColliderComponent.TorsoY] ?? 0) + deltaY;
  mantle.positionZ[target] = (colliders[VanguardMantleColliderComponent.TorsoZ] ?? 0) + deltaZ;
}

function projectCapsule(
  mantle: MutableVanguardMantleData,
  target: number,
  colliders: Float32Array,
  start: VanguardMantleColliderComponent,
  end: VanguardMantleColliderComponent,
  radius: number,
  depthRadius: number,
): void {
  const startX = colliders[start] ?? 0;
  const startY = colliders[start + 1] ?? 0;
  const startZ = colliders[start + 2] ?? 0;
  const segmentX = (colliders[end] ?? 0) - startX;
  const segmentY = (colliders[end + 1] ?? 0) - startY;
  const segmentZ = (colliders[end + 2] ?? 0) - startZ;
  const depthScale = radius / Math.max(depthRadius, 0.000001);
  const relativeX = (mantle.positionX[target] ?? 0) - startX;
  const relativeY = (mantle.positionY[target] ?? 0) - startY;
  const relativeZ = (mantle.positionZ[target] ?? 0) - startZ;
  const scaledSegmentZ = segmentZ * depthScale;
  const scaledRelativeZ = relativeZ * depthScale;
  const segmentLengthSquared = segmentX * segmentX
    + segmentY * segmentY
    + scaledSegmentZ * scaledSegmentZ;
  const along = segmentLengthSquared <= 0.000001
    ? 0
    : Math.max(0, Math.min(1,
      (relativeX * segmentX + relativeY * segmentY + scaledRelativeZ * scaledSegmentZ)
        / segmentLengthSquared));
  const closestX = startX + segmentX * along;
  const closestY = startY + segmentY * along;
  const closestZ = startZ + segmentZ * along;
  let deltaX = (mantle.positionX[target] ?? 0) - closestX;
  let deltaY = (mantle.positionY[target] ?? 0) - closestY;
  let deltaZ = (mantle.positionZ[target] ?? 0) - closestZ;
  const distanceSquared = deltaX * deltaX
    + deltaY * deltaY
    + deltaZ * deltaZ * depthScale * depthScale;
  if (distanceSquared >= radius * radius) {
    return;
  }
  if (distanceSquared <= 0.000001) {
    deltaX = 0;
    deltaY = 0;
    deltaZ = depthRadius;
  } else {
    const scale = radius / Math.sqrt(distanceSquared);
    deltaX *= scale;
    deltaY *= scale;
    deltaZ *= scale;
  }
  mantle.positionX[target] = closestX + deltaX;
  mantle.positionY[target] = closestY + deltaY;
  mantle.positionZ[target] = closestZ + deltaZ;
}
