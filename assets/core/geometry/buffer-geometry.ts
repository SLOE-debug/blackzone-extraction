import { BufferAttribute } from './buffer-attribute';
import { type NumericTypedArray } from '../entities/entity-schema';

/** 支持的索引缓冲类型。 */
export type GeometryIndexArray = Uint16Array | Uint32Array;

/** 索引缓冲的显式格式。 */
export enum GeometryIndexFormat {
  Uint16 = 'uint16',
  Uint32 = 'uint32',
}

/** 三维几何包围盒。 */
export interface GeometryBounds {
  readonly minX: number;
  readonly minY: number;
  readonly minZ: number;
  readonly maxX: number;
  readonly maxY: number;
  readonly maxZ: number;
}

/** 几何属性集合约束。 */
export type GeometryAttributeMap = Readonly<
  Record<string, BufferAttribute<NumericTypedArray, number>>
>;

/** 仅包含三分量位置流的几何属性。 */
export type PositionGeometryAttributes = Readonly<{
  position: BufferAttribute<Float32Array, 3>;
}>;

/**
 * 保存固定容量的强类型顶点属性和索引缓冲。
 *
 * @typeParam TAttributes 属性名称到属性类型的精确映射。
 * @typeParam TIndex 索引缓冲类型。
 */
export class BufferGeometry<
  TAttributes extends GeometryAttributeMap,
  TIndex extends GeometryIndexArray,
> {
  public vertexCount = 0;
  public indexCount = 0;

  constructor(
    public readonly maxVertices: number,
    public readonly maxIndices: number,
    public readonly attributes: TAttributes,
    public readonly index: TIndex,
  ) {
    if (!Number.isInteger(maxVertices) || maxVertices <= 0) {
      throw new Error('几何顶点容量必须是正整数。');
    }
    if (!Number.isInteger(maxIndices) || maxIndices <= 0) {
      throw new Error('几何索引容量必须是正整数。');
    }
    if (index.length < maxIndices) {
      throw new Error('索引缓冲容量不足。');
    }

    for (const attributeName of Object.keys(attributes)) {
      const attribute = attributes[attributeName];
      if (attribute === undefined || attribute.count < maxVertices) {
        throw new Error(`几何属性容量不足：${attributeName}`);
      }
    }
  }

  /** 根据属性名称返回精确属性类型。 */
  public getAttribute<TKey extends keyof TAttributes>(name: TKey): TAttributes[TKey] {
    return this.attributes[name];
  }

  /**
   * 提交当前有效顶点数和索引数。
   */
  public commitCounts(vertexCount: number, indexCount: number): void {
    if (!Number.isInteger(vertexCount) || vertexCount < 0 || vertexCount > this.maxVertices) {
      throw new Error('有效顶点数量超过几何容量。');
    }
    if (!Number.isInteger(indexCount) || indexCount < 0 || indexCount > this.maxIndices) {
      throw new Error('有效索引数量超过几何容量。');
    }

    this.vertexCount = vertexCount;
    this.indexCount = indexCount;
  }

  /** 返回当前有效索引的零拷贝视图。 */
  public getIndexView(): TIndex {
    return this.index.subarray(0, this.indexCount) as TIndex;
  }
}

/**
 * 针对动态位置流优化的 BufferGeometry。
 */
export class PositionBufferGeometry<
  TIndex extends GeometryIndexArray = GeometryIndexArray,
> extends BufferGeometry<PositionGeometryAttributes, TIndex> {
  public readonly positions: Float32Array;

  constructor(maxVertices: number, maxIndices: number, index: TIndex) {
    const positionAttribute = new BufferAttribute(new Float32Array(maxVertices * 3), 3);
    super(maxVertices, maxIndices, Object.freeze({ position: positionAttribute }), index);
    this.positions = positionAttribute.array;
  }

  /** 返回当前有效位置流的零拷贝视图。 */
  public getPositionView(): Float32Array {
    return this.positions.subarray(0, this.vertexCount * 3);
  }

  /** 计算当前有效位置流的包围盒。 */
  public computeBounds(): GeometryBounds {
    if (this.vertexCount <= 0) {
      throw new Error('空几何无法计算包围盒。');
    }

    const positions = this.getPositionView();
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let minZ = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    let maxZ = Number.NEGATIVE_INFINITY;

    for (let offset = 0; offset < positions.length; offset += 3) {
      const x = positions[offset] ?? 0;
      const y = positions[offset + 1] ?? 0;
      const z = positions[offset + 2] ?? 0;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      minZ = Math.min(minZ, z);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      maxZ = Math.max(maxZ, z);
    }

    return Object.freeze({ minX, minY, minZ, maxX, maxY, maxZ });
  }
}

/**
 * 按显式索引格式创建位置几何。
 */
export function createPositionGeometry(
  maxVertices: number,
  maxIndices: number,
  indexFormat: GeometryIndexFormat,
): PositionBufferGeometry {
  if (indexFormat === GeometryIndexFormat.Uint16) {
    if (maxVertices > 65535) {
      throw new Error('Uint16 索引几何的顶点容量不能超过 65535。');
    }
    return new PositionBufferGeometry(maxVertices, maxIndices, new Uint16Array(maxIndices));
  }

  return new PositionBufferGeometry(maxVertices, maxIndices, new Uint32Array(maxIndices));
}
