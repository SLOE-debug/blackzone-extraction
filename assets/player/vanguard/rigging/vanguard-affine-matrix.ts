import { type VanguardBoneMatrixArray } from '../model/vanguard-bone';
import { writeBasisQuaternion } from './vanguard-pose-math';

const EPSILON = 0.000001;

/** 把单位四元数、平移和统一缩放写入项目使用的三乘四仿射矩阵。 */
export function writeAffineMatrix(
  target: VanguardBoneMatrixArray,
  offset: number,
  quaternion: Float32Array | Float64Array,
  quaternionOffset: number,
  positionX: number,
  positionY: number,
  positionZ: number,
  scale: number,
): void {
  const x = quaternion[quaternionOffset] ?? 0;
  const y = quaternion[quaternionOffset + 1] ?? 0;
  const z = quaternion[quaternionOffset + 2] ?? 0;
  const w = quaternion[quaternionOffset + 3] ?? 1;
  const xx = x * x;
  const yy = y * y;
  const zz = z * z;
  const xy = x * y;
  const xz = x * z;
  const yz = y * z;
  const xw = x * w;
  const yw = y * w;
  const zw = z * w;
  target[offset] = (1 - 2 * (yy + zz)) * scale;
  target[offset + 1] = 2 * (xy + zw) * scale;
  target[offset + 2] = 2 * (xz - yw) * scale;
  target[offset + 3] = 2 * (xy - zw) * scale;
  target[offset + 4] = (1 - 2 * (xx + zz)) * scale;
  target[offset + 5] = 2 * (yz + xw) * scale;
  target[offset + 6] = 2 * (xz + yw) * scale;
  target[offset + 7] = 2 * (yz - xw) * scale;
  target[offset + 8] = (1 - 2 * (xx + yy)) * scale;
  target[offset + 9] = positionX;
  target[offset + 10] = positionY;
  target[offset + 11] = positionZ;
}

/** 从仿射矩阵提取不含统一缩放的旋转四元数。 */
export function writeMatrixRotationQuaternion(
  target: Float32Array | Float64Array,
  targetOffset: number,
  matrix: VanguardBoneMatrixArray,
  matrixOffset: number,
): void {
  const scale = Math.max(Math.hypot(
    matrix[matrixOffset] ?? 1,
    matrix[matrixOffset + 1] ?? 0,
    matrix[matrixOffset + 2] ?? 0,
  ), EPSILON);
  writeBasisQuaternion(
    target,
    targetOffset,
    (matrix[matrixOffset] ?? 1) / scale,
    (matrix[matrixOffset + 1] ?? 0) / scale,
    (matrix[matrixOffset + 2] ?? 0) / scale,
    (matrix[matrixOffset + 3] ?? 0) / scale,
    (matrix[matrixOffset + 4] ?? 1) / scale,
    (matrix[matrixOffset + 5] ?? 0) / scale,
    (matrix[matrixOffset + 6] ?? 0) / scale,
    (matrix[matrixOffset + 7] ?? 0) / scale,
    (matrix[matrixOffset + 8] ?? 1) / scale,
  );
}
