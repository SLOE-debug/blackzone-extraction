export const VANGUARD_QUATERNION_COMPONENTS = 4;
const EPSILON = 0.000001;

/** 写入单位四元数。 */
export function writeIdentityQuaternion(target: Float32Array | Float64Array, offset: number): void {
  target[offset] = 0;
  target[offset + 1] = 0;
  target[offset + 2] = 0;
  target[offset + 3] = 1;
}

/** 写入绕归一化轴旋转的四元数。 */
export function writeAxisAngleQuaternion(
  target: Float32Array | Float64Array,
  offset: number,
  axisX: number,
  axisY: number,
  axisZ: number,
  angle: number,
): void {
  const inverseAxisLength = 1 / Math.max(Math.hypot(axisX, axisY, axisZ), EPSILON);
  const halfAngle = angle * 0.5;
  const sine = Math.sin(halfAngle) * inverseAxisLength;
  target[offset] = axisX * sine;
  target[offset + 1] = axisY * sine;
  target[offset + 2] = axisZ * sine;
  target[offset + 3] = Math.cos(halfAngle);
}

/** 按 Y 偏航、X 前倾、Z 侧倾的固定顺序写入局部旋转。 */
export function writeYawPitchRollQuaternion(
  target: Float32Array | Float64Array,
  offset: number,
  yaw: number,
  pitch: number,
  roll: number,
): void {
  const halfYaw = yaw * 0.5;
  const halfPitch = pitch * 0.5;
  const halfRoll = roll * 0.5;
  const yawSine = Math.sin(halfYaw);
  const yawCosine = Math.cos(halfYaw);
  const pitchSine = Math.sin(halfPitch);
  const pitchCosine = Math.cos(halfPitch);
  const rollSine = Math.sin(halfRoll);
  const rollCosine = Math.cos(halfRoll);
  target[offset] = yawCosine * pitchSine * rollCosine
    + yawSine * pitchCosine * rollSine;
  target[offset + 1] = yawSine * pitchCosine * rollCosine
    - yawCosine * pitchSine * rollSine;
  target[offset + 2] = yawCosine * pitchCosine * rollSine
    - yawSine * pitchSine * rollCosine;
  target[offset + 3] = yawCosine * pitchCosine * rollCosine
    + yawSine * pitchSine * rollSine;
  normalizeQuaternion(target, offset);
}

/** 写入两个四元数按先右后左组合的乘积。 */
export function multiplyQuaternions(
  target: Float32Array | Float64Array,
  targetOffset: number,
  left: Float32Array | Float64Array,
  leftOffset: number,
  right: Float32Array | Float64Array,
  rightOffset: number,
): void {
  multiplyQuaternionComponents(
    target,
    targetOffset,
    left[leftOffset] ?? 0,
    left[leftOffset + 1] ?? 0,
    left[leftOffset + 2] ?? 0,
    left[leftOffset + 3] ?? 1,
    right[rightOffset] ?? 0,
    right[rightOffset + 1] ?? 0,
    right[rightOffset + 2] ?? 0,
    right[rightOffset + 3] ?? 1,
  );
}

/** 写入两个四元数组件的乘积。 */
export function multiplyQuaternionComponents(
  target: Float32Array | Float64Array,
  offset: number,
  leftX: number,
  leftY: number,
  leftZ: number,
  leftW: number,
  rightX: number,
  rightY: number,
  rightZ: number,
  rightW: number,
): void {
  target[offset] = leftW * rightX + leftX * rightW + leftY * rightZ - leftZ * rightY;
  target[offset + 1] = leftW * rightY - leftX * rightZ + leftY * rightW + leftZ * rightX;
  target[offset + 2] = leftW * rightZ + leftX * rightY - leftY * rightX + leftZ * rightW;
  target[offset + 3] = leftW * rightW - leftX * rightX - leftY * rightY - leftZ * rightZ;
  normalizeQuaternion(target, offset);
}

/** 写入源四元数的逆；动画旋转均为单位四元数。 */
export function invertQuaternion(
  target: Float32Array | Float64Array,
  targetOffset: number,
  source: Float32Array | Float64Array,
  sourceOffset: number,
): void {
  target[targetOffset] = -(source[sourceOffset] ?? 0);
  target[targetOffset + 1] = -(source[sourceOffset + 1] ?? 0);
  target[targetOffset + 2] = -(source[sourceOffset + 2] ?? 0);
  target[targetOffset + 3] = source[sourceOffset + 3] ?? 1;
}

/** 在最短弧上连续插值两个单位四元数。 */
export function slerpQuaternions(
  target: Float32Array | Float64Array,
  targetOffset: number,
  from: Float32Array | Float64Array,
  fromOffset: number,
  to: Float32Array | Float64Array,
  toOffset: number,
  amount: number,
): void {
  const fromX = from[fromOffset] ?? 0;
  const fromY = from[fromOffset + 1] ?? 0;
  const fromZ = from[fromOffset + 2] ?? 0;
  const fromW = from[fromOffset + 3] ?? 1;
  let toX = to[toOffset] ?? 0;
  let toY = to[toOffset + 1] ?? 0;
  let toZ = to[toOffset + 2] ?? 0;
  let toW = to[toOffset + 3] ?? 1;
  let dot = fromX * toX + fromY * toY + fromZ * toZ + fromW * toW;
  if (dot < 0) {
    dot = -dot;
    toX = -toX;
    toY = -toY;
    toZ = -toZ;
    toW = -toW;
  }
  const clampedAmount = Math.max(0, Math.min(1, amount));
  if (dot > 0.9995) {
    target[targetOffset] = fromX + (toX - fromX) * clampedAmount;
    target[targetOffset + 1] = fromY + (toY - fromY) * clampedAmount;
    target[targetOffset + 2] = fromZ + (toZ - fromZ) * clampedAmount;
    target[targetOffset + 3] = fromW + (toW - fromW) * clampedAmount;
    normalizeQuaternion(target, targetOffset);
    return;
  }
  const theta = Math.acos(Math.max(-1, Math.min(1, dot)));
  const inverseSine = 1 / Math.sin(theta);
  const fromWeight = Math.sin((1 - clampedAmount) * theta) * inverseSine;
  const toWeight = Math.sin(clampedAmount * theta) * inverseSine;
  target[targetOffset] = fromX * fromWeight + toX * toWeight;
  target[targetOffset + 1] = fromY * fromWeight + toY * toWeight;
  target[targetOffset + 2] = fromZ * fromWeight + toZ * toWeight;
  target[targetOffset + 3] = fromW * fromWeight + toW * toWeight;
}

/** 由局部 Y 轴段方向与期望局部 Z 朝向构造稳定旋转。 */
export function writeSegmentQuaternion(
  target: Float32Array | Float64Array,
  offset: number,
  directionX: number,
  directionY: number,
  directionZ: number,
  preferredForwardX: number,
  preferredForwardY: number,
  preferredForwardZ: number,
): void {
  const inverseDirectionLength = 1 / Math.max(
    Math.hypot(directionX, directionY, directionZ),
    EPSILON,
  );
  const upX = directionX * inverseDirectionLength;
  const upY = directionY * inverseDirectionLength;
  const upZ = directionZ * inverseDirectionLength;
  const forwardDot = upX * preferredForwardX
    + upY * preferredForwardY
    + upZ * preferredForwardZ;
  let forwardX = preferredForwardX - upX * forwardDot;
  let forwardY = preferredForwardY - upY * forwardDot;
  let forwardZ = preferredForwardZ - upZ * forwardDot;
  let forwardLength = Math.hypot(forwardX, forwardY, forwardZ);
  if (forwardLength <= EPSILON) {
    forwardX = -upX * upY;
    forwardY = 1 - upY * upY;
    forwardZ = -upZ * upY;
    forwardLength = Math.max(Math.hypot(forwardX, forwardY, forwardZ), EPSILON);
  }
  forwardX /= forwardLength;
  forwardY /= forwardLength;
  forwardZ /= forwardLength;
  let rightX = upY * forwardZ - upZ * forwardY;
  let rightY = upZ * forwardX - upX * forwardZ;
  let rightZ = upX * forwardY - upY * forwardX;
  const inverseRightLength = 1 / Math.max(Math.hypot(rightX, rightY, rightZ), EPSILON);
  rightX *= inverseRightLength;
  rightY *= inverseRightLength;
  rightZ *= inverseRightLength;
  forwardX = rightY * upZ - rightZ * upY;
  forwardY = rightZ * upX - rightX * upZ;
  forwardZ = rightX * upY - rightY * upX;
  writeBasisQuaternion(
    target,
    offset,
    rightX,
    rightY,
    rightZ,
    upX,
    upY,
    upZ,
    forwardX,
    forwardY,
    forwardZ,
  );
}

/** 把正交基向量转换为单位四元数。 */
export function writeBasisQuaternion(
  target: Float32Array | Float64Array,
  offset: number,
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
    target[offset] = (upZ - forwardY) / scale;
    target[offset + 1] = (forwardX - rightZ) / scale;
    target[offset + 2] = (rightY - upX) / scale;
    target[offset + 3] = scale * 0.25;
  } else if (rightX > upY && rightX > forwardZ) {
    const scale = Math.sqrt(1 + rightX - upY - forwardZ) * 2;
    target[offset] = scale * 0.25;
    target[offset + 1] = (rightY + upX) / scale;
    target[offset + 2] = (rightZ + forwardX) / scale;
    target[offset + 3] = (upZ - forwardY) / scale;
  } else if (upY > forwardZ) {
    const scale = Math.sqrt(1 + upY - rightX - forwardZ) * 2;
    target[offset] = (rightY + upX) / scale;
    target[offset + 1] = scale * 0.25;
    target[offset + 2] = (upZ + forwardY) / scale;
    target[offset + 3] = (forwardX - rightZ) / scale;
  } else {
    const scale = Math.sqrt(1 + forwardZ - rightX - upY) * 2;
    target[offset] = (rightZ + forwardX) / scale;
    target[offset + 1] = (upZ + forwardY) / scale;
    target[offset + 2] = scale * 0.25;
    target[offset + 3] = (rightY - upX) / scale;
  }
  normalizeQuaternion(target, offset);
}

/** 使用单位四元数旋转一个向量并写入目标数组。 */
export function rotateVectorByQuaternion(
  target: Float32Array | Float64Array,
  targetOffset: number,
  vectorX: number,
  vectorY: number,
  vectorZ: number,
  quaternion: Float32Array | Float64Array,
  quaternionOffset: number,
): void {
  const quaternionX = quaternion[quaternionOffset] ?? 0;
  const quaternionY = quaternion[quaternionOffset + 1] ?? 0;
  const quaternionZ = quaternion[quaternionOffset + 2] ?? 0;
  const quaternionW = quaternion[quaternionOffset + 3] ?? 1;
  const twiceCrossX = 2 * (quaternionY * vectorZ - quaternionZ * vectorY);
  const twiceCrossY = 2 * (quaternionZ * vectorX - quaternionX * vectorZ);
  const twiceCrossZ = 2 * (quaternionX * vectorY - quaternionY * vectorX);
  target[targetOffset] = vectorX
    + quaternionW * twiceCrossX
    + quaternionY * twiceCrossZ
    - quaternionZ * twiceCrossY;
  target[targetOffset + 1] = vectorY
    + quaternionW * twiceCrossY
    + quaternionZ * twiceCrossX
    - quaternionX * twiceCrossZ;
  target[targetOffset + 2] = vectorZ
    + quaternionW * twiceCrossZ
    + quaternionX * twiceCrossY
    - quaternionY * twiceCrossX;
}

/** 写入把一个归一化方向沿最短弧旋转到另一个方向的四元数。 */
export function writeFromToQuaternion(
  target: Float32Array | Float64Array,
  offset: number,
  fromX: number,
  fromY: number,
  fromZ: number,
  toX: number,
  toY: number,
  toZ: number,
): void {
  const inverseFromLength = 1 / Math.max(Math.hypot(fromX, fromY, fromZ), EPSILON);
  const inverseToLength = 1 / Math.max(Math.hypot(toX, toY, toZ), EPSILON);
  const normalizedFromX = fromX * inverseFromLength;
  const normalizedFromY = fromY * inverseFromLength;
  const normalizedFromZ = fromZ * inverseFromLength;
  const normalizedToX = toX * inverseToLength;
  const normalizedToY = toY * inverseToLength;
  const normalizedToZ = toZ * inverseToLength;
  const dot = Math.max(-1, Math.min(1,
    normalizedFromX * normalizedToX
      + normalizedFromY * normalizedToY
      + normalizedFromZ * normalizedToZ,
  ));
  if (dot > 1 - EPSILON) {
    writeIdentityQuaternion(target, offset);
    return;
  }
  if (dot < -1 + EPSILON) {
    let axisX = 0;
    let axisY = -normalizedFromZ;
    let axisZ = normalizedFromY;
    if (Math.hypot(axisX, axisY, axisZ) <= EPSILON) {
      axisX = -normalizedFromY;
      axisY = normalizedFromX;
      axisZ = 0;
    }
    writeAxisAngleQuaternion(target, offset, axisX, axisY, axisZ, Math.PI);
    return;
  }
  target[offset] = normalizedFromY * normalizedToZ
    - normalizedFromZ * normalizedToY;
  target[offset + 1] = normalizedFromZ * normalizedToX
    - normalizedFromX * normalizedToZ;
  target[offset + 2] = normalizedFromX * normalizedToY
    - normalizedFromY * normalizedToX;
  target[offset + 3] = 1 + dot;
  normalizeQuaternion(target, offset);
}

/** 将旋转向量通过四元数指数映射写成单位旋转。 */
export function writeRotationVectorQuaternion(
  target: Float32Array | Float64Array,
  offset: number,
  rotationX: number,
  rotationY: number,
  rotationZ: number,
): void {
  const angle = Math.hypot(rotationX, rotationY, rotationZ);
  if (angle <= EPSILON) {
    target[offset] = rotationX * 0.5;
    target[offset + 1] = rotationY * 0.5;
    target[offset + 2] = rotationZ * 0.5;
    target[offset + 3] = 1;
    normalizeQuaternion(target, offset);
    return;
  }
  writeAxisAngleQuaternion(
    target,
    offset,
    rotationX / angle,
    rotationY / angle,
    rotationZ / angle,
    angle,
  );
}

/** 将单位四元数通过最短弧对数映射写成旋转向量。 */
export function writeQuaternionRotationVector(
  target: Float32Array | Float64Array,
  targetOffset: number,
  quaternion: Float32Array | Float64Array,
  quaternionOffset: number,
): void {
  let x = quaternion[quaternionOffset] ?? 0;
  let y = quaternion[quaternionOffset + 1] ?? 0;
  let z = quaternion[quaternionOffset + 2] ?? 0;
  let w = quaternion[quaternionOffset + 3] ?? 1;
  if (w < 0) {
    x = -x;
    y = -y;
    z = -z;
    w = -w;
  }
  const sineHalfAngle = Math.hypot(x, y, z);
  if (sineHalfAngle <= EPSILON) {
    target[targetOffset] = x * 2;
    target[targetOffset + 1] = y * 2;
    target[targetOffset + 2] = z * 2;
    return;
  }
  const angleScale = 2 * Math.atan2(sineHalfAngle, Math.max(0, w)) / sineHalfAngle;
  target[targetOffset] = x * angleScale;
  target[targetOffset + 1] = y * angleScale;
  target[targetOffset + 2] = z * angleScale;
}

/** 原地归一化一个四元数。 */
export function normalizeQuaternion(target: Float32Array | Float64Array, offset: number): void {
  const x = target[offset] ?? 0;
  const y = target[offset + 1] ?? 0;
  const z = target[offset + 2] ?? 0;
  const w = target[offset + 3] ?? 1;
  const inverseLength = 1 / Math.max(Math.hypot(x, y, z, w), EPSILON);
  target[offset] = x * inverseLength;
  target[offset + 1] = y * inverseLength;
  target[offset + 2] = z * inverseLength;
  target[offset + 3] = w * inverseLength;
}
