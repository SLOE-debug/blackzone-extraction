import { nextRandom, randomInteger } from '../math/xorshift32';

/** 加权战利品表中的一条强类型候选。 */
export interface WeightedLootEntry<TId> {
  readonly id: TId;
  readonly weight: number;
}

/** 一次掉落的数量区间和加权候选配置。 */
export interface WeightedLootTableOptions<TId> {
  readonly minimumDrops: number;
  readonly maximumDrops: number;
  readonly entries: readonly Readonly<WeightedLootEntry<TId>>[];
}

/** 可由宝箱、怪物或任务奖励复用的战利品抽取接口。 */
export interface LootTable<TId> {
  /** 使用调用方持有的随机状态返回一次独立掉落结果。 */
  roll(randomState: Uint32Array, stateIndex: number): readonly TId[];
}

/** 按包含上限的随机数量和权重抽取战利品。 */
export class WeightedLootTable<TId> implements LootTable<TId> {
  private readonly minimumDrops: number;
  private readonly maximumDrops: number;
  private readonly entries: readonly Readonly<WeightedLootEntry<TId>>[];
  private readonly totalWeight: number;

  constructor(options: Readonly<WeightedLootTableOptions<TId>>) {
    validateOptions(options);
    this.minimumDrops = options.minimumDrops;
    this.maximumDrops = options.maximumDrops;
    this.entries = Object.freeze(options.entries.map((entry) => Object.freeze({
      id: entry.id,
      weight: entry.weight,
    })));
    this.totalWeight = this.entries.reduce((total, entry) => total + entry.weight, 0);
  }

  public roll(randomState: Uint32Array, stateIndex: number): readonly TId[] {
    if (!Number.isInteger(stateIndex) || stateIndex < 0 || stateIndex >= randomState.length) {
      throw new Error('战利品随机状态索引超出 Uint32Array 范围。');
    }
    const count = randomInteger(
      randomState,
      stateIndex,
      this.minimumDrops,
      this.maximumDrops + 1,
    );
    const result: TId[] = [];
    for (let index = 0; index < count; index++) {
      result.push(this.select(randomState, stateIndex));
    }
    return Object.freeze(result);
  }

  private select(randomState: Uint32Array, stateIndex: number): TId {
    let cursor = nextRandom(randomState, stateIndex) * this.totalWeight;
    for (const entry of this.entries) {
      cursor -= entry.weight;
      if (cursor < 0) {
        return entry.id;
      }
    }
    const fallback = this.entries[this.entries.length - 1];
    if (fallback === undefined) {
      throw new Error('战利品表没有可抽取条目。');
    }
    return fallback.id;
  }
}

function validateOptions<TId>(options: Readonly<WeightedLootTableOptions<TId>>): void {
  if (!Number.isInteger(options.minimumDrops)
    || !Number.isInteger(options.maximumDrops)
    || options.minimumDrops <= 0
    || options.maximumDrops < options.minimumDrops) {
    throw new Error('战利品数量区间必须使用递增的正整数。');
  }
  if (options.entries.length <= 0) {
    throw new Error('战利品表至少需要一个候选条目。');
  }
  for (const entry of options.entries) {
    if (!Number.isFinite(entry.weight) || entry.weight <= 0) {
      throw new Error('战利品候选权重必须是有限正数。');
    }
  }
}
