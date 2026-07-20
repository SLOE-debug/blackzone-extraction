import { TREASURE_CHEST_LAYOUT } from '../model/treasure-chest-layout';

const TAU = Math.PI * 2;

/** 宝箱信标提示使用的可复用动画采样结果。 */
export interface MutableTreasureChestAttentionSample {
  signalStrength: number;
  proximity: number;
  pulse: number;
}

/** 宝箱信标根据距离变化的低频呼吸参数。 */
export const TREASURE_CHEST_ATTENTION = Object.freeze({
  samplesPerSecond: 30,
  cycleDuration: 2.65,
  pulseSharpness: 1.45,
  awarenessRadius: 11,
  distantFloor: 0.44,
  distantPeak: 0.72,
  nearbyFloor: 0.64,
  nearbyPeak: 1,
});

/**
 * 根据时间和玩家距离求值地面光环、漂浮光片与局部灯光的统一强度。
 *
 * 关闭状态始终保留远距离可读的基础亮度，进入交互距离后增强；开启后立即熄灭。
 */
export function evaluateTreasureChestAttention(
  elapsed: number,
  playerDistanceSquared: number,
  active: boolean,
  result: MutableTreasureChestAttentionSample,
): void {
  const config = TREASURE_CHEST_ATTENTION;
  if (!active) {
    result.signalStrength = 0;
    result.proximity = 0;
    result.pulse = 0;
    return;
  }
  if (
    !Number.isFinite(elapsed)
    || elapsed < 0
    || !Number.isFinite(playerDistanceSquared)
    || playerDistanceSquared < 0
  ) {
    throw new Error('宝箱呼吸提示要求有限的非负时间和距离。');
  }
  const distance = Math.sqrt(playerDistanceSquared);
  const proximity = 1 - clamp01(
    (distance - TREASURE_CHEST_LAYOUT.interactionRadius)
      / (config.awarenessRadius - TREASURE_CHEST_LAYOUT.interactionRadius),
  );
  const wave = 0.5 - Math.cos(elapsed / config.cycleDuration * TAU) * 0.5;
  const easedWave = wave * wave * (3 - 2 * wave);
  const pulse = Math.pow(easedWave, config.pulseSharpness);
  const floor = lerp(config.distantFloor, config.nearbyFloor, proximity);
  const peak = lerp(config.distantPeak, config.nearbyPeak, proximity);
  result.signalStrength = lerp(floor, peak, pulse);
  result.proximity = proximity;
  result.pulse = pulse;
}

function lerp(start: number, end: number, amount: number): number {
  return start + (end - start) * amount;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
