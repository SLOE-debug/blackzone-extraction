import { type NumericTypedArray } from '../entities/entity-schema';

/**
 * 表示固定分量宽度的强类型顶点属性。
 *
 * @typeParam TArray 属性底层 TypedArray 类型。
 * @typeParam TItemSize 每个顶点包含的分量数量。
 */
export class BufferAttribute<
  TArray extends NumericTypedArray,
  TItemSize extends number,
> {
  public readonly count: number;

  constructor(
    public readonly array: TArray,
    public readonly itemSize: TItemSize,
    public readonly normalized = false,
  ) {
    if (!Number.isInteger(itemSize) || itemSize <= 0 || array.length % itemSize !== 0) {
      throw new Error('顶点属性长度必须能够被分量宽度整除。');
    }

    this.count = array.length / itemSize;
  }
}
