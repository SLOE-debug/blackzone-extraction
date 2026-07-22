import { type Material } from 'cc';
import { type VenomLobberCombatOptions } from './venom-lobber-combat-options';

/** Venom Lobber 固定容量群体使用的初始二维区域。 */
export interface VenomLobberSpawnArea {
  readonly centerX: number;
  readonly centerY: number;
  readonly width: number;
  readonly height: number;
}

/** 创建自主 Venom Lobber 群体所需的完整公开参数。 */
export interface VenomLobberPopulationOptions {
  readonly count: number;
  readonly initialPopulationCount: number;
  readonly spawnArea: Readonly<VenomLobberSpawnArea>;
  readonly seed: number;
  readonly surfaceMaterialTemplate: Material;
  readonly combat: Readonly<VenomLobberCombatOptions>;
}

/** 已完成边界校验的群体基础参数。 */
export interface NormalizedVenomLobberOptions {
  readonly count: number;
  readonly initialPopulationCount: number;
  readonly spawnArea: Readonly<VenomLobberSpawnArea>;
  readonly seed: number;
  readonly surfaceMaterialTemplate: Material;
}

/** 校验并冻结群体配置。 */
export function normalizeVenomLobberOptions(
  options: Readonly<VenomLobberPopulationOptions>,
): NormalizedVenomLobberOptions {
  if (!Number.isInteger(options.count)
    || options.count <= 0
    || !Number.isInteger(options.initialPopulationCount)
    || options.initialPopulationCount < 0
    || options.initialPopulationCount > options.count) {
    throw new Error('Venom Lobber 容量和初始人口必须位于有效整数范围。');
  }
  if (!Number.isFinite(options.spawnArea.centerX)
    || !Number.isFinite(options.spawnArea.centerY)
    || !Number.isFinite(options.spawnArea.width)
    || !Number.isFinite(options.spawnArea.height)
    || options.spawnArea.width <= 0
    || options.spawnArea.height <= 0
    || !Number.isFinite(options.seed)) {
    throw new Error('Venom Lobber 生成区域与随机种子无效。');
  }
  if (options.surfaceMaterialTemplate.effectAsset === null) {
    throw new Error('Venom Lobber 受光材质模板没有有效 EffectAsset。');
  }
  return Object.freeze({
    count: options.count,
    initialPopulationCount: options.initialPopulationCount,
    spawnArea: Object.freeze({ ...options.spawnArea }),
    seed: Math.trunc(options.seed),
    surfaceMaterialTemplate: options.surfaceMaterialTemplate,
  });
}
