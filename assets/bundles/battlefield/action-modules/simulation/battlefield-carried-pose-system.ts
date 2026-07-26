import { type MutableSpatialPosition } from '../../../../core/contracts/spatial-movement-constraint';
import {
  type BattlefieldActionMonsterGateway,
  type BattlefieldThrowMovementConstraint,
} from '../model/battlefield-action-runtime-contracts';
import { type BattlefieldActionPlayerPose } from '../model/battlefield-combat-module-intent';
import { type BattlefieldManipulationState } from '../model/battlefield-manipulation-state';

const BASE_PULL_DURATION_SECONDS = 0.22;
const DIRECTION_BLEND_SECONDS = 0.3;
const ANCHOR_CORRECTION_TOLERANCE = 0.025;
const MINIMUM_COLLISION_RADIUS = 0.18;
const ANCHOR_DISTANCE_SCALES = new Float32Array([1, 0.68, 0.34, 0]);
const ANCHOR_HEIGHT_OFFSETS = new Float32Array([0, 0, 0.55, 1]);

/** 解析安全携带槽位，并把抓取方向平滑过渡到玩家当前朝向。 */
export class BattlefieldCarriedPoseSystem {
  private readonly anchor: MutableSpatialPosition = { x: 0, y: 0, z: 0 };
  private readonly resolved: MutableSpatialPosition = { x: 0, y: 0, z: 0 };

  constructor(
    private readonly state: BattlefieldManipulationState,
    private readonly monsters: BattlefieldActionMonsterGateway,
    private readonly movement: BattlefieldThrowMovementConstraint,
  ) {}

  /** 推进拉拽动画、环境约束和怪物权威姿态；目标失效时清空操作槽。 */
  public update(player: Readonly<BattlefieldActionPlayerPose>, deltaTime: number): void {
    const carried = this.state.data.carried;
    const duration = (carried.duration[0] ?? 0) + Math.max(0, deltaTime);
    carried.duration[0] = duration;
    const massFactor = Math.max(1, Math.min(
      1.65,
      Math.sqrt(this.state.data.throwable.mass[0] ?? 1),
    ));
    const pullDuration = BASE_PULL_DURATION_SECONDS * massFactor;
    const headingX = Math.sin(player.heading);
    const headingZ = Math.cos(player.heading);
    const directionBlend = smoothStep(clamp01(
      (duration - pullDuration * 0.72) / DIRECTION_BLEND_SECONDS,
    ));
    let anchorDirectionX = lerp(carried.grabDirectionX[0] ?? headingX, headingX, directionBlend);
    let anchorDirectionZ = lerp(carried.grabDirectionZ[0] ?? headingZ, headingZ, directionBlend);
    const directionLength = Math.hypot(anchorDirectionX, anchorDirectionZ);
    if (directionLength > 0.000001) {
      anchorDirectionX /= directionLength;
      anchorDirectionZ /= directionLength;
    } else {
      anchorDirectionX = headingX;
      anchorDirectionZ = headingZ;
    }
    this.resolveAnchor(player, anchorDirectionX, anchorDirectionZ);
    const pullProgress = smoothStep(clamp01(duration / pullDuration));
    const desiredX = lerp(carried.startX[0] ?? player.x, this.anchor.x, pullProgress);
    const desiredY = lerp(carried.startY[0] ?? player.y, this.anchor.y, pullProgress);
    const desiredZ = lerp(carried.startZ[0] ?? player.z, this.anchor.z, pullProgress);
    const radius = Math.max(
      MINIMUM_COLLISION_RADIUS,
      this.state.data.throwable.collisionRadius[0] ?? MINIMUM_COLLISION_RADIUS,
    );
    this.movement.resolveSpatial(
      carried.x[0] ?? desiredX,
      carried.y[0] ?? desiredY,
      carried.z[0] ?? desiredZ,
      desiredX,
      desiredY,
      desiredZ,
      radius,
      this.resolved,
    );
    carried.x[0] = this.resolved.x;
    carried.y[0] = this.resolved.y;
    carried.z[0] = this.resolved.z;
    const poseHeading = Math.atan2(anchorDirectionX, anchorDirectionZ);
    if (!this.monsters.synchronizeManipulatedPose(
      this.state.data.reference.populationId[0] ?? 0,
      this.state.data.reference.entityId[0] ?? 0,
      this.resolved.x,
      this.resolved.y,
      this.resolved.z,
      poseHeading,
    )) {
      this.state.clear();
    }
  }

  /** 依次尝试缩短、抬高与头顶槽位，全部失败时保持上一帧合法位置。 */
  private resolveAnchor(
    player: Readonly<BattlefieldActionPlayerPose>,
    directionX: number,
    directionZ: number,
  ): void {
    const carried = this.state.data.carried;
    const radius = Math.max(
      MINIMUM_COLLISION_RADIUS,
      this.state.data.throwable.collisionRadius[0] ?? MINIMUM_COLLISION_RADIUS,
    );
    const offsetZ = carried.offsetZ[0] ?? 1.05;
    const baseY = player.y + (carried.offsetY[0] ?? 1.7);
    this.anchor.x = carried.x[0] ?? player.x;
    this.anchor.y = carried.y[0] ?? baseY;
    this.anchor.z = carried.z[0] ?? player.z;
    for (let index = 0; index < ANCHOR_DISTANCE_SCALES.length; index++) {
      const distance = offsetZ * (ANCHOR_DISTANCE_SCALES[index] ?? 0);
      const targetX = player.x + directionX * distance;
      const targetY = baseY + (ANCHOR_HEIGHT_OFFSETS[index] ?? 0);
      const targetZ = player.z + directionZ * distance;
      this.movement.resolveSpatial(
        player.x,
        targetY,
        player.z,
        targetX,
        targetY,
        targetZ,
        radius,
        this.resolved,
      );
      if (Math.hypot(
        this.resolved.x - targetX,
        this.resolved.y - targetY,
        this.resolved.z - targetZ,
      ) > ANCHOR_CORRECTION_TOLERANCE) {
        continue;
      }
      this.anchor.x = targetX;
      this.anchor.y = targetY;
      this.anchor.z = targetZ;
      return;
    }
  }
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function lerp(start: number, end: number, progress: number): number {
  return start + (end - start) * progress;
}

function smoothStep(value: number): number {
  return value * value * (3 - value * 2);
}
