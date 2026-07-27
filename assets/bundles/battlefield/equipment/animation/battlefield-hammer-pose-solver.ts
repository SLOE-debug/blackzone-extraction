import { WeaponAction } from '../../../../core/equipment/equipment';
import { type HeldEquipmentProfile } from '../catalog/battlefield-equipment-prototype';

const EPSILON = 0.000001;

/** 角色右手 FK 输出的大锤主握点世界姿态。 */
export interface BattlefieldHammerGripPose {
  readonly rootX: number;
  readonly rootY: number;
  readonly rootZ: number;
  readonly rotationX: number;
  readonly rotationY: number;
  readonly rotationZ: number;
  readonly rotationW: number;
}

/** 求解器写出的模型根变换与真实锤头世界位置。 */
export interface MutableBattlefieldHammerWorldPose {
  rootX: number;
  rootY: number;
  rootZ: number;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
  rotationW: number;
  headX: number;
  headY: number;
  headZ: number;
}

/**
 * 以右手主握点为硬约束，把大锤局部锤头放到动作轨迹上。
 *
 * 锤柄长度始终来自模型 MainGrip 与 HammerHead 的真实局部距离，模型根位置则由
 * MainGrip 反解，因此视觉模型和战斗扫掠共享同一个锤头权威点。
 */
export class BattlefieldHammerPoseSolver {
  private readonly localDirection = new Float64Array(3);
  private readonly rigBasis = new Float64Array(9);
  private readonly rotatedGrip = new Float64Array(3);

  public solve(
    profile: Readonly<HeldEquipmentProfile>,
    grip: Readonly<BattlefieldHammerGripPose>,
    action: WeaponAction,
    progress: number,
    recoverSide: -1 | 0 | 1,
    result: MutableBattlefieldHammerWorldPose,
  ): void {
    const localGrip = profile.mainGripLocalPosition;
    const localHead = profile.hammerHeadLocalPosition;
    const handleLength = Math.hypot(
      localHead.x - localGrip.x,
      localHead.y - localGrip.y,
      localHead.z - localGrip.z,
    ) * profile.heldScale;
    if (handleLength <= EPSILON) {
      throw new Error('大锤主握点与锤头局部位置不能重合。');
    }

    const t = Math.max(0, Math.min(1, progress));
    writeLocalHeadDirection(this.localDirection, action, t, recoverSide);
    const inverseDirectionLength = 1 / Math.max(Math.hypot(
      this.localDirection[0] ?? 0,
      this.localDirection[1] ?? 0,
      this.localDirection[2] ?? 0,
    ), EPSILON);
    const directionX = (this.localDirection[0] ?? 0) * inverseDirectionLength;
    const directionY = (this.localDirection[1] ?? -1) * inverseDirectionLength;
    const directionZ = (this.localDirection[2] ?? 0) * inverseDirectionLength;

    writeQuaternionBasis(this.rigBasis, grip);
    const rightX = this.rigBasis[0] ?? 1;
    const rightY = this.rigBasis[1] ?? 0;
    const rightZ = this.rigBasis[2] ?? 0;
    const upX = this.rigBasis[3] ?? 0;
    const upY = this.rigBasis[4] ?? 1;
    const upZ = this.rigBasis[5] ?? 0;
    const forwardX = this.rigBasis[6] ?? 0;
    const forwardY = this.rigBasis[7] ?? 0;
    const forwardZ = this.rigBasis[8] ?? 1;
    const headDirectionX = rightX * directionX + upX * directionY + forwardX * directionZ;
    const headDirectionY = rightY * directionX + upY * directionY + forwardY * directionZ;
    const headDirectionZ = rightZ * directionX + upZ * directionY + forwardZ * directionZ;
    const modelUpX = -headDirectionX;
    const modelUpY = -headDirectionY;
    const modelUpZ = -headDirectionZ;

    const rightDot = rightX * modelUpX + rightY * modelUpY + rightZ * modelUpZ;
    let modelRightX = rightX - modelUpX * rightDot;
    let modelRightY = rightY - modelUpY * rightDot;
    let modelRightZ = rightZ - modelUpZ * rightDot;
    let rightLength = Math.hypot(modelRightX, modelRightY, modelRightZ);
    if (rightLength <= EPSILON) {
      const forwardDot = forwardX * modelUpX
        + forwardY * modelUpY
        + forwardZ * modelUpZ;
      modelRightX = forwardX - modelUpX * forwardDot;
      modelRightY = forwardY - modelUpY * forwardDot;
      modelRightZ = forwardZ - modelUpZ * forwardDot;
      rightLength = Math.max(Math.hypot(modelRightX, modelRightY, modelRightZ), EPSILON);
    }
    modelRightX /= rightLength;
    modelRightY /= rightLength;
    modelRightZ /= rightLength;
    const modelForwardX = modelRightY * modelUpZ - modelRightZ * modelUpY;
    const modelForwardY = modelRightZ * modelUpX - modelRightX * modelUpZ;
    const modelForwardZ = modelRightX * modelUpY - modelRightY * modelUpX;
    writeBasisQuaternion(
      result,
      modelRightX,
      modelRightY,
      modelRightZ,
      modelUpX,
      modelUpY,
      modelUpZ,
      modelForwardX,
      modelForwardY,
      modelForwardZ,
    );

    rotateVector(
      this.rotatedGrip,
      localGrip.x * profile.heldScale,
      localGrip.y * profile.heldScale,
      localGrip.z * profile.heldScale,
      result.rotationX,
      result.rotationY,
      result.rotationZ,
      result.rotationW,
    );
    result.rootX = grip.rootX - (this.rotatedGrip[0] ?? 0);
    result.rootY = grip.rootY - (this.rotatedGrip[1] ?? 0);
    result.rootZ = grip.rootZ - (this.rotatedGrip[2] ?? 0);
    result.headX = grip.rootX + headDirectionX * handleLength;
    result.headY = grip.rootY + headDirectionY * handleLength;
    result.headZ = grip.rootZ + headDirectionZ * handleLength;
  }
}

function writeLocalHeadDirection(
  result: Float64Array,
  action: WeaponAction,
  progress: number,
  recoverSide: -1 | 0 | 1,
): void {
  const neutralX = 0;
  const neutralY = -0.96;
  const neutralZ = 0.28;
  switch (action) {
    case WeaponAction.WindupLeft:
      interpolateDirection(result, neutralX, neutralY, neutralZ, 0.84, -0.3, -0.45, progress);
      break;
    case WeaponAction.WindupRight:
      interpolateDirection(result, neutralX, neutralY, neutralZ, -0.84, -0.3, -0.45, progress);
      break;
    case WeaponAction.SwingLeft:
      interpolateDirection(result, 0.84, -0.3, -0.45, -0.86, -0.18, 0.48, progress);
      break;
    case WeaponAction.SwingRight:
      interpolateDirection(result, -0.84, -0.3, -0.45, 0.86, -0.18, 0.48, progress);
      break;
    case WeaponAction.Uppercut:
      interpolateDirection(result, 0, -0.78, 0.63, 0, 0.7, 0.72, progress);
      break;
    case WeaponAction.GroundSlam:
      if (progress < 0.58) {
        interpolateDirection(result, 0, 0.72, -0.7, 0, -0.94, 0.35, progress / 0.58);
      } else {
        interpolateDirection(
          result,
          0,
          -0.94,
          0.35,
          0,
          -0.99,
          0.16,
          (progress - 0.58) / 0.42,
        );
      }
      break;
    case WeaponAction.Spin: {
      const localLag = -0.14 * Math.sin(progress * Math.PI * 6);
      writePoint(result, Math.cos(localLag), -0.16, Math.sin(localLag));
      break;
    }
    case WeaponAction.Recover: {
      const side = recoverSide === 0 ? 1 : recoverSide;
      interpolateDirection(
        result,
        side * 0.86,
        -0.18,
        0.48,
        neutralX,
        neutralY,
        neutralZ,
        progress,
      );
      break;
    }
    case WeaponAction.Idle:
      writePoint(result, neutralX, neutralY, neutralZ);
      break;
  }
}

function interpolateDirection(
  result: Float64Array,
  startX: number,
  startY: number,
  startZ: number,
  endX: number,
  endY: number,
  endZ: number,
  progress: number,
): void {
  const amount = progress * progress * (3 - progress * 2);
  writePoint(
    result,
    startX + (endX - startX) * amount,
    startY + (endY - startY) * amount,
    startZ + (endZ - startZ) * amount,
  );
}

function writePoint(result: Float64Array, x: number, y: number, z: number): void {
  result[0] = x;
  result[1] = y;
  result[2] = z;
}

function writeQuaternionBasis(result: Float64Array, rotation: BattlefieldHammerGripPose): void {
  const x = rotation.rotationX;
  const y = rotation.rotationY;
  const z = rotation.rotationZ;
  const w = rotation.rotationW;
  result[0] = 1 - 2 * (y * y + z * z);
  result[1] = 2 * (x * y + z * w);
  result[2] = 2 * (x * z - y * w);
  result[3] = 2 * (x * y - z * w);
  result[4] = 1 - 2 * (x * x + z * z);
  result[5] = 2 * (y * z + x * w);
  result[6] = 2 * (x * z + y * w);
  result[7] = 2 * (y * z - x * w);
  result[8] = 1 - 2 * (x * x + y * y);
}

function writeBasisQuaternion(
  result: MutableBattlefieldHammerWorldPose,
  rightX: number,
  rightY: number,
  rightZ: number,
  upX: number,
  upY: number,
  upZ: number,
  forwardX: number,
  forwardY: number,
  forwardZ: number,
): void {
  const trace = rightX + upY + forwardZ;
  if (trace > 0) {
    const scale = Math.sqrt(trace + 1) * 2;
    result.rotationX = (upZ - forwardY) / scale;
    result.rotationY = (forwardX - rightZ) / scale;
    result.rotationZ = (rightY - upX) / scale;
    result.rotationW = scale * 0.25;
    return;
  }
  if (rightX > upY && rightX > forwardZ) {
    const scale = Math.sqrt(1 + rightX - upY - forwardZ) * 2;
    result.rotationX = scale * 0.25;
    result.rotationY = (rightY + upX) / scale;
    result.rotationZ = (rightZ + forwardX) / scale;
    result.rotationW = (upZ - forwardY) / scale;
    return;
  }
  if (upY > forwardZ) {
    const scale = Math.sqrt(1 + upY - rightX - forwardZ) * 2;
    result.rotationX = (rightY + upX) / scale;
    result.rotationY = scale * 0.25;
    result.rotationZ = (upZ + forwardY) / scale;
    result.rotationW = (forwardX - rightZ) / scale;
    return;
  }
  const scale = Math.sqrt(1 + forwardZ - rightX - upY) * 2;
  result.rotationX = (rightZ + forwardX) / scale;
  result.rotationY = (upZ + forwardY) / scale;
  result.rotationZ = scale * 0.25;
  result.rotationW = (rightY - upX) / scale;
}

function rotateVector(
  result: Float64Array,
  x: number,
  y: number,
  z: number,
  rotationX: number,
  rotationY: number,
  rotationZ: number,
  rotationW: number,
): void {
  const doubledX = 2 * (rotationY * z - rotationZ * y);
  const doubledY = 2 * (rotationZ * x - rotationX * z);
  const doubledZ = 2 * (rotationX * y - rotationY * x);
  result[0] = x + rotationW * doubledX + rotationY * doubledZ - rotationZ * doubledY;
  result[1] = y + rotationW * doubledY + rotationZ * doubledX - rotationX * doubledZ;
  result[2] = z + rotationW * doubledZ + rotationX * doubledY - rotationY * doubledX;
}
