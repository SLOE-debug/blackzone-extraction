import { TREASURE_CHEST_LAYOUT } from '../model/treasure-chest-layout';

const TAU = Math.PI * 2;

/** 宝箱呼吸提示使用的可复用自发光颜色结果。 */
export interface MutableTreasureChestAttentionColor {
  red: number;
  green: number;
  blue: number;
}

/** 不增加渲染 Pass 的宝箱材质呼吸参数。 */
export const TREASURE_CHEST_ATTENTION = Object.freeze({
  samplesPerSecond: 30,
  cycleDuration: 2.35,
  pulseSharpness: 2,
  awarenessRadius: 7.5,
  minimum: Object.freeze({ red: 3, green: 1, blue: 0 }),
  distantPeak: Object.freeze({ red: 38, green: 15, blue: 4 }),
  nearbyPeak: Object.freeze({ red: 58, green: 27, blue: 8 }),
});

/**
 * 根据时间和玩家距离求值已有 Standard 材质的暖色自发光。
 *
 * 关闭状态使用低频呼吸吸引视线，进入交互距离时增强；开启后立即回到最低值。
 */
export function evaluateTreasureChestAttention(
  elapsed: number,
  playerDistanceSquared: number,
  active: boolean,
  result: MutableTreasureChestAttentionColor,
): void {
  const config = TREASURE_CHEST_ATTENTION;
  if (!active) {
    writeColor(config.minimum, result);
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
  const peakRed = lerp(config.distantPeak.red, config.nearbyPeak.red, proximity);
  const peakGreen = lerp(config.distantPeak.green, config.nearbyPeak.green, proximity);
  const peakBlue = lerp(config.distantPeak.blue, config.nearbyPeak.blue, proximity);
  result.red = Math.round(lerp(config.minimum.red, peakRed, pulse));
  result.green = Math.round(lerp(config.minimum.green, peakGreen, pulse));
  result.blue = Math.round(lerp(config.minimum.blue, peakBlue, pulse));
}

function writeColor(
  source: Readonly<{ red: number; green: number; blue: number }>,
  result: MutableTreasureChestAttentionColor,
): void {
  result.red = source.red;
  result.green = source.green;
  result.blue = source.blue;
}

function lerp(start: number, end: number, amount: number): number {
  return start + (end - start) * amount;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
