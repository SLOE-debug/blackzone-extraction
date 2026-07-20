import { randomRange } from '../../../../core/math/xorshift32';
import { type LootScatterTrajectory } from './loot-scatter-trajectory';

/** 为被替换的手持武器生成克制的侧后方轻抛轨迹。 */
export function createPlayerDiscardTrajectory(
  randomState: Uint32Array,
  stateIndex: number,
  originX: number,
  originY: number,
  originZ: number,
  heading: number,
): Readonly<LootScatterTrajectory> {
  if (!Number.isFinite(originX)
    || !Number.isFinite(originY)
    || !Number.isFinite(originZ)
    || !Number.isFinite(heading)) {
    throw new Error('玩家替换武器的轻抛起点与朝向必须是有限数值。');
  }
  const angle = Math.PI * 1.5 - heading
    + randomRange(randomState, stateIndex, -0.62, 0.62);
  const distance = randomRange(randomState, stateIndex, 0.9, 1.55);
  const curveDirection = randomRange(randomState, stateIndex, 0, 1) < 0.5 ? -1 : 1;
  return Object.freeze({
    delay: 0,
    flightDuration: randomRange(randomState, stateIndex, 0.38, 0.52),
    settleDuration: randomRange(randomState, stateIndex, 0.16, 0.25),
    startX: originX,
    startY: originY,
    startZ: originZ,
    targetX: originX + Math.cos(angle) * distance,
    targetY: 0.22,
    targetZ: originZ + Math.sin(angle) * distance,
    liftHeight: randomRange(randomState, stateIndex, 0.36, 0.62),
    curveOffset: curveDirection * randomRange(randomState, stateIndex, 0.08, 0.24),
    startRotationX: randomRange(randomState, stateIndex, -12, 18),
    startRotationY: randomRange(randomState, stateIndex, -35, 35),
    startRotationZ: randomRange(randomState, stateIndex, -10, 10),
    spinRotationX: randomRange(randomState, stateIndex, 100, 190),
    spinRotationY: curveDirection * randomRange(randomState, stateIndex, 80, 160),
    spinRotationZ: -curveDirection * randomRange(randomState, stateIndex, 45, 110),
    restRotationX: 90 + randomRange(randomState, stateIndex, -7, 8),
    restRotationY: randomRange(randomState, stateIndex, -180, 180),
    restRotationZ: randomRange(randomState, stateIndex, -9, 9),
  });
}
