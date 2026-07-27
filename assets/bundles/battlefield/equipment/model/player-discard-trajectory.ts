import { type LootScatterTrajectory } from '../../loot/model/loot-scatter-trajectory';

/** 玩家从背包向前方抛出装备时需要的世界参数。 */
export interface PlayerDiscardTrajectoryRequest {
  readonly itemInstanceSeed: number;
  readonly originX: number;
  readonly originY: number;
  readonly originZ: number;
  readonly directionX: number;
  readonly directionZ: number;
}

/** 根据永久实例种子生成确定、可复现的短距离丢弃轨迹。 */
export function createPlayerDiscardTrajectory(
  request: Readonly<PlayerDiscardTrajectoryRequest>,
): Readonly<LootScatterTrajectory> {
  const directionLength = Math.hypot(request.directionX, request.directionZ);
  if (![request.originX, request.originY, request.originZ].every(Number.isFinite)
    || Math.abs(directionLength - 1) > 0.001) {
    throw new Error('玩家丢弃轨迹必须使用有限原点和单位平面方向。');
  }
  const side = (request.itemInstanceSeed & 1) === 0 ? -1 : 1;
  const perpendicularX = -request.directionZ;
  const perpendicularZ = request.directionX;
  return Object.freeze({
    delay: 0,
    flightDuration: 0.52,
    settleDuration: 0.24,
    startX: request.originX,
    startY: request.originY + 1.15,
    startZ: request.originZ,
    targetX: request.originX + request.directionX * 1.65 + perpendicularX * side * 0.16,
    targetY: 0.22,
    targetZ: request.originZ + request.directionZ * 1.65 + perpendicularZ * side * 0.16,
    liftHeight: 0.92,
    curveOffset: side * 0.18,
    startRotationX: 12,
    startRotationY: request.itemInstanceSeed % 360,
    startRotationZ: -8 * side,
    spinRotationX: 310 * side,
    spinRotationY: 220,
    spinRotationZ: -170 * side,
    restRotationX: 90 + (request.itemInstanceSeed % 11) - 5,
    restRotationY: (request.itemInstanceSeed * 47) % 360,
    restRotationZ: side * 5,
  });
}
