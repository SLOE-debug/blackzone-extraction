import { normalizeRandomSeed } from '../../../../core/math/xorshift32';

const UINT32_RANGE = 4294967296;

/**
 * 为一次真实掉落事件混入运行时熵，使掉落数量与爆散轨迹不被静态场景种子锁死。
 *
 * 静态场景造型仍使用固定 seed；此随机源只服务于玩家触发的低频玩法事件。
 */
export function createLootRuntimeRandomSeed(baseSeed: number): number {
  const runtimeEntropy = Math.floor(Math.random() * UINT32_RANGE);
  return normalizeRandomSeed(normalizeRandomSeed(baseSeed) ^ runtimeEntropy);
}
