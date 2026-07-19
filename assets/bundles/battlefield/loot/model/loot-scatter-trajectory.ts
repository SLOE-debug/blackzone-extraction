import { randomRange } from '../../../../core/math/xorshift32';

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/** 单件掉落物从宝箱内部到地面的完整抛射计划。 */
export interface LootScatterTrajectory {
  readonly delay: number;
  readonly flightDuration: number;
  readonly settleDuration: number;
  readonly startX: number;
  readonly startY: number;
  readonly startZ: number;
  readonly targetX: number;
  readonly targetY: number;
  readonly targetZ: number;
  readonly liftHeight: number;
  readonly startRotationX: number;
  readonly startRotationY: number;
  readonly startRotationZ: number;
  readonly spinRotationX: number;
  readonly spinRotationY: number;
  readonly spinRotationZ: number;
  readonly restRotationX: number;
  readonly restRotationY: number;
  readonly restRotationZ: number;
}

/** 抛射求值写入的可复用世界姿态。 */
export interface MutableLootScatterPose {
  x: number;
  y: number;
  z: number;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
}

/** 掉落物当前所处的抛射阶段。 */
export enum LootScatterPhase {
  Waiting,
  Flying,
  Settling,
  Landed,
}

/** 围绕宝箱生成互相错开的确定性爆散轨迹。 */
export function createLootScatterTrajectories(
  count: number,
  randomState: Uint32Array,
  stateIndex: number,
  originX: number,
  originY: number,
  originZ: number,
): readonly Readonly<LootScatterTrajectory>[] {
  if (!Number.isInteger(count) || count <= 0) {
    throw new Error('宝箱爆散掉落数量必须是正整数。');
  }
  if (stateIndex < 0 || stateIndex >= randomState.length) {
    throw new Error('宝箱爆散随机状态索引越界。');
  }
  const angleOrigin = randomRange(randomState, stateIndex, -Math.PI, Math.PI);
  const trajectories: Readonly<LootScatterTrajectory>[] = [];
  for (let index = 0; index < count; index++) {
    const angle = angleOrigin + index * GOLDEN_ANGLE
      + randomRange(randomState, stateIndex, -0.24, 0.24);
    const radius = randomRange(randomState, stateIndex, 1.45, 3.25);
    const spinDirection = index % 2 === 0 ? 1 : -1;
    trajectories.push(Object.freeze({
      delay: index * 0.065,
      flightDuration: randomRange(randomState, stateIndex, 0.76, 1.04),
      settleDuration: randomRange(randomState, stateIndex, 0.24, 0.38),
      startX: originX + randomRange(randomState, stateIndex, -0.12, 0.12),
      startY: originY,
      startZ: originZ + randomRange(randomState, stateIndex, -0.1, 0.1),
      targetX: originX + Math.cos(angle) * radius,
      targetY: 0.22,
      targetZ: originZ + Math.sin(angle) * radius,
      liftHeight: randomRange(randomState, stateIndex, 1.7, 2.75),
      startRotationX: randomRange(randomState, stateIndex, -25, 35),
      startRotationY: randomRange(randomState, stateIndex, -180, 180),
      startRotationZ: randomRange(randomState, stateIndex, -20, 20),
      spinRotationX: spinDirection * randomRange(randomState, stateIndex, 420, 720),
      spinRotationY: -spinDirection * randomRange(randomState, stateIndex, 240, 540),
      spinRotationZ: spinDirection * randomRange(randomState, stateIndex, 160, 360),
      restRotationX: 90 + randomRange(randomState, stateIndex, -7, 8),
      restRotationY: randomRange(randomState, stateIndex, -180, 180),
      restRotationZ: randomRange(randomState, stateIndex, -9, 9),
    }));
  }
  return Object.freeze(trajectories);
}

/** 求值飞行抛物线、一次衰减触地弹跳和最终静止姿态。 */
export function evaluateLootScatterTrajectory(
  trajectory: Readonly<LootScatterTrajectory>,
  elapsed: number,
  result: MutableLootScatterPose,
): LootScatterPhase {
  if (!Number.isFinite(elapsed)) {
    throw new Error('掉落物抛射时间必须是有限数值。');
  }
  const localTime = elapsed - trajectory.delay;
  if (localTime < 0) {
    writeStartPose(trajectory, result);
    return LootScatterPhase.Waiting;
  }
  if (localTime < trajectory.flightDuration) {
    const amount = localTime / trajectory.flightDuration;
    result.x = lerp(trajectory.startX, trajectory.targetX, amount);
    result.y = lerp(trajectory.startY, trajectory.targetY, amount)
      + trajectory.liftHeight * 4 * amount * (1 - amount);
    result.z = lerp(trajectory.startZ, trajectory.targetZ, amount);
    result.rotationX = trajectory.startRotationX + trajectory.spinRotationX * amount;
    result.rotationY = trajectory.startRotationY + trajectory.spinRotationY * amount;
    result.rotationZ = trajectory.startRotationZ + trajectory.spinRotationZ * amount;
    return LootScatterPhase.Flying;
  }

  const settleTime = localTime - trajectory.flightDuration;
  if (settleTime < trajectory.settleDuration) {
    const amount = settleTime / trajectory.settleDuration;
    const eased = smootherStep(amount);
    result.x = trajectory.targetX;
    result.y = trajectory.targetY + Math.sin(amount * Math.PI) * 0.085 * (1 - amount);
    result.z = trajectory.targetZ;
    result.rotationX = lerp(
      trajectory.startRotationX + trajectory.spinRotationX,
      trajectory.restRotationX,
      eased,
    );
    result.rotationY = lerp(
      trajectory.startRotationY + trajectory.spinRotationY,
      trajectory.restRotationY,
      eased,
    );
    result.rotationZ = lerp(
      trajectory.startRotationZ + trajectory.spinRotationZ,
      trajectory.restRotationZ,
      eased,
    );
    return LootScatterPhase.Settling;
  }

  result.x = trajectory.targetX;
  result.y = trajectory.targetY;
  result.z = trajectory.targetZ;
  result.rotationX = trajectory.restRotationX;
  result.rotationY = trajectory.restRotationY;
  result.rotationZ = trajectory.restRotationZ;
  return LootScatterPhase.Landed;
}

function writeStartPose(
  trajectory: Readonly<LootScatterTrajectory>,
  result: MutableLootScatterPose,
): void {
  result.x = trajectory.startX;
  result.y = trajectory.startY;
  result.z = trajectory.startZ;
  result.rotationX = trajectory.startRotationX;
  result.rotationY = trajectory.startRotationY;
  result.rotationZ = trajectory.startRotationZ;
}

function lerp(start: number, end: number, amount: number): number {
  return start + (end - start) * amount;
}

function smootherStep(value: number): number {
  return value * value * value * (value * (value * 6 - 15) + 10);
}
