const DEFAULT_RANDOM_STATE = 0x6d2b79f5;
const UINT32_RANGE = 4294967296;

/**
 * 将任意有限种子标准化为非零的 Uint32 随机状态。
 */
export function normalizeRandomSeed(seed: number): number {
  if (!Number.isFinite(seed)) {
    throw new Error('随机种子必须是有限数值。');
  }

  const normalized = Math.trunc(seed) >>> 0;
  return normalized === 0 ? DEFAULT_RANDOM_STATE : normalized;
}

/**
 * 混合基础种子与实体标识，生成互相隔离的随机序列起点。
 */
export function mixRandomSeed(seed: number, id: number): number {
  const mixed = normalizeRandomSeed(seed) ^ Math.imul(id + 1, 0x9e3779b1);
  return normalizeRandomSeed(mixed);
}

/** 推进一次 xorshift32 状态。 */
export function advanceRandomState(state: number): number {
  let value = normalizeRandomSeed(state) | 0;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  return normalizeRandomSeed(value);
}

/**
 * 推进指定实体的随机状态并返回零到一之间的随机值。
 */
export function nextRandom(states: Uint32Array, index: number): number {
  const state = advanceRandomState(states[index] ?? DEFAULT_RANDOM_STATE);
  states[index] = state;
  return state / UINT32_RANGE;
}

/** 返回指定闭开区间内的随机浮点数。 */
export function randomRange(states: Uint32Array, index: number, min: number, max: number): number {
  return min + (max - min) * nextRandom(states, index);
}

/** 返回指定闭开区间内的随机整数。 */
export function randomInteger(
  states: Uint32Array,
  index: number,
  min: number,
  maxExclusive: number,
): number {
  return Math.floor(randomRange(states, index, min, maxExclusive));
}
