import { BufferAttribute } from './buffer-attribute';
import { type NumericTypedArray } from '../entities/entity-schema';
import {
  getVertexComponentCount,
  LIT_COLOR_LAYOUT,
  type LitColorVertexSemantic,
  type UnlitColorVertexSemantic,
  UNLIT_COLOR_LAYOUT,
  type VertexComponentCount,
  type VertexLayout,
  VertexSemantic,
  type VertexStreams,
} from '../mesh/vertex-layout';

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

/** 把 SoA 顶点语义映射为 Cocos 使用的属性名称。 */
type VertexAttributeName<TSemantic extends VertexSemantic> =
  TSemantic extends VertexSemantic.Position
    ? 'position'
    : TSemantic extends VertexSemantic.Normal
      ? 'normal'
      : 'color';

/** 指定顶点语义集合对应的精确 BufferAttribute 映射。 */
export type VertexLayoutGeometryAttributes<TSemantics extends VertexSemantic> =
  Readonly<{
    [TSemantic in TSemantics as VertexAttributeName<TSemantic>]: BufferAttribute<
      Float32Array,
      VertexComponentCount<TSemantic>
    >;
  }>;

/** 包含位置、法线和颜色流的表面几何属性。 */
export type SurfaceGeometryAttributes =
  VertexLayoutGeometryAttributes<LitColorVertexSemantic>;

/** 只包含位置和颜色流的无光表面几何属性。 */
export type UnlitColorGeometryAttributes =
  VertexLayoutGeometryAttributes<UnlitColorVertexSemantic>;

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
 * 保存由 VertexLayout 唯一声明的 SoA 顶点流。
 *
 * @typeParam TSemantics 布局实际拥有的顶点语义联合。
 * @typeParam TIndex 索引缓冲类型。
 */
export class VertexLayoutBufferGeometry<
  TSemantics extends VertexSemantic,
  TIndex extends GeometryIndexArray = GeometryIndexArray,
> extends BufferGeometry<VertexLayoutGeometryAttributes<TSemantics>, TIndex> {
  public readonly streams: VertexStreams<TSemantics>;

  constructor(
    maxVertices: number,
    maxIndices: number,
    public readonly layout: VertexLayout<TSemantics>,
    index: TIndex,
  ) {
    const streams = layout.createStreams(maxVertices);
    super(
      maxVertices,
      maxIndices,
      createVertexLayoutAttributes(layout, streams),
      index,
    );
    this.streams = streams;
  }

  /** 返回指定语义当前有效范围的零拷贝视图。 */
  public getStreamView<TSemantic extends TSemantics>(
    semantic: TSemantic,
  ): VertexStreams<TSemantics>[TSemantic] {
    const stream = this.streams[semantic];
    return stream.subarray(
      0,
      this.vertexCount * getVertexComponentCount(semantic),
    ) as VertexStreams<TSemantics>[TSemantic];
  }

  /** 计算当前有效位置流的包围盒。 */
  public computeBounds(): GeometryBounds {
    const streams = this.streams as Partial<Record<VertexSemantic, Float32Array>>;
    const positions = streams[VertexSemantic.Position];
    if (positions === undefined) {
      throw new Error('不含位置流的几何无法计算包围盒。');
    }
    if (this.vertexCount <= 0) {
      throw new Error('空几何无法计算包围盒。');
    }

    return computePositionBounds(positions.subarray(0, this.vertexCount * 3));
  }
}

/**
 * 针对动态位置、法线与颜色流优化的 BufferGeometry。
 */
export class SurfaceBufferGeometry<
  TIndex extends GeometryIndexArray = GeometryIndexArray,
> extends VertexLayoutBufferGeometry<LitColorVertexSemantic, TIndex> {
  public readonly positions: Float32Array;
  public readonly normals: Float32Array;
  public readonly colors: Float32Array;

  constructor(maxVertices: number, maxIndices: number, index: TIndex) {
    super(maxVertices, maxIndices, LIT_COLOR_LAYOUT, index);
    this.positions = this.streams.positions;
    this.normals = this.streams.normals;
    this.colors = this.streams.colors;
  }

  /** 返回当前有效位置流的零拷贝视图。 */
  public getPositionView(): Float32Array {
    return this.positions.subarray(0, this.vertexCount * 3);
  }

  /** 返回当前有效法线流的零拷贝视图。 */
  public getNormalView(): Float32Array {
    return this.normals.subarray(0, this.vertexCount * 3);
  }

  /** 返回当前有效颜色流的零拷贝视图。 */
  public getColorView(): Float32Array {
    return this.colors.subarray(0, this.vertexCount * 4);
  }

}

/** 针对无光材质优化且不会分配法线流的动态表面几何。 */
export class UnlitColorBufferGeometry<
  TIndex extends GeometryIndexArray = GeometryIndexArray,
> extends VertexLayoutBufferGeometry<UnlitColorVertexSemantic, TIndex> {
  public readonly positions: Float32Array;
  public readonly colors: Float32Array;

  constructor(maxVertices: number, maxIndices: number, index: TIndex) {
    super(maxVertices, maxIndices, UNLIT_COLOR_LAYOUT, index);
    this.positions = this.streams.positions;
    this.colors = this.streams.colors;
  }

  /** 返回当前有效位置流的零拷贝视图。 */
  public getPositionView(): Float32Array {
    return this.getStreamView(VertexSemantic.Position);
  }

  /** 返回当前有效颜色流的零拷贝视图。 */
  public getColorView(): Float32Array {
    return this.getStreamView(VertexSemantic.Color);
  }
}

/**
 * 为静态受光表面补充 UV 参数流。
 *
 * UV 由具体材质解释；核心层只保证它与顶点索引一一对应。
 */
export class StaticSurfaceBufferGeometry<
  TIndex extends GeometryIndexArray = GeometryIndexArray,
> extends SurfaceBufferGeometry<TIndex> {
  public readonly uvs: Float32Array;

  constructor(maxVertices: number, maxIndices: number, index: TIndex) {
    super(maxVertices, maxIndices, index);
    this.uvs = new Float32Array(maxVertices * 2);
  }

  /** 返回当前有效 UV 流的零拷贝视图。 */
  public getUvView(): Float32Array {
    return this.uvs.subarray(0, this.vertexCount * 2);
  }
}

/**
 * 按显式索引格式创建动态表面几何。
 */
export function createSurfaceGeometry(
  maxVertices: number,
  maxIndices: number,
  indexFormat: GeometryIndexFormat,
): SurfaceBufferGeometry {
  if (indexFormat === GeometryIndexFormat.Uint16) {
    if (maxVertices > 65535) {
      throw new Error('Uint16 索引几何的顶点容量不能超过 65535。');
    }
    return new SurfaceBufferGeometry(maxVertices, maxIndices, new Uint16Array(maxIndices));
  }

  return new SurfaceBufferGeometry(maxVertices, maxIndices, new Uint32Array(maxIndices));
}

/** 按显式索引格式创建不含法线流的无光动态表面几何。 */
export function createUnlitColorGeometry(
  maxVertices: number,
  maxIndices: number,
  indexFormat: GeometryIndexFormat,
): UnlitColorBufferGeometry {
  if (indexFormat === GeometryIndexFormat.Uint16) {
    if (maxVertices > 65535) {
      throw new Error('Uint16 索引几何的顶点容量不能超过 65535。');
    }
    return new UnlitColorBufferGeometry(
      maxVertices,
      maxIndices,
      new Uint16Array(maxIndices),
    );
  }

  return new UnlitColorBufferGeometry(
    maxVertices,
    maxIndices,
    new Uint32Array(maxIndices),
  );
}

/** 按受光布局创建包含位置、法线和颜色的动态几何。 */
export function createVertexLayoutGeometry(
  layout: typeof LIT_COLOR_LAYOUT,
  maxVertices: number,
  maxIndices: number,
  indexFormat: GeometryIndexFormat,
): SurfaceBufferGeometry;

/** 按无光布局创建只包含位置和颜色的动态几何。 */
export function createVertexLayoutGeometry(
  layout: typeof UNLIT_COLOR_LAYOUT,
  maxVertices: number,
  maxIndices: number,
  indexFormat: GeometryIndexFormat,
): UnlitColorBufferGeometry;

/** 由计划携带的精确布局选择对应几何类型。 */
export function createVertexLayoutGeometry(
  layout: typeof LIT_COLOR_LAYOUT | typeof UNLIT_COLOR_LAYOUT,
  maxVertices: number,
  maxIndices: number,
  indexFormat: GeometryIndexFormat,
): SurfaceBufferGeometry | UnlitColorBufferGeometry {
  if (layout === LIT_COLOR_LAYOUT) {
    return createSurfaceGeometry(maxVertices, maxIndices, indexFormat);
  }
  if (layout === UNLIT_COLOR_LAYOUT) {
    return createUnlitColorGeometry(maxVertices, maxIndices, indexFormat);
  }
  throw new Error('核心层不支持该动态顶点布局。');
}

/** 创建包含位置、法线、颜色和 UV 的静态表面几何。 */
export function createStaticSurfaceGeometry(
  maxVertices: number,
  maxIndices: number,
  indexFormat: GeometryIndexFormat,
): StaticSurfaceBufferGeometry {
  if (indexFormat === GeometryIndexFormat.Uint16) {
    if (maxVertices > 65535) {
      throw new Error('Uint16 索引几何的顶点容量不能超过 65535。');
    }
    return new StaticSurfaceBufferGeometry(
      maxVertices,
      maxIndices,
      new Uint16Array(maxIndices),
    );
  }

  return new StaticSurfaceBufferGeometry(
    maxVertices,
    maxIndices,
    new Uint32Array(maxIndices),
  );
}

/** 为布局拥有的每个 SoA 流创建同容量的 BufferAttribute。 */
function createVertexLayoutAttributes<TSemantics extends VertexSemantic>(
  layout: VertexLayout<TSemantics>,
  streams: VertexStreams<TSemantics>,
): VertexLayoutGeometryAttributes<TSemantics> {
  const attributes: Partial<Record<'position' | 'normal' | 'color', BufferAttribute<
    Float32Array,
    3 | 4
  >>> = {};
  for (const semantic of layout.semantics) {
    const attributeName = getVertexAttributeName(semantic);
    attributes[attributeName] = new BufferAttribute(
      streams[semantic],
      getVertexComponentCount(semantic),
    );
  }
  return Object.freeze(attributes) as VertexLayoutGeometryAttributes<TSemantics>;
}

/** 把核心语义转换为引擎属性名称。 */
function getVertexAttributeName(
  semantic: VertexSemantic,
): 'position' | 'normal' | 'color' {
  switch (semantic) {
    case VertexSemantic.Position:
      return 'position';
    case VertexSemantic.Normal:
      return 'normal';
    case VertexSemantic.Color:
      return 'color';
  }
}

/** 计算一个非空位置流的轴对齐包围盒。 */
function computePositionBounds(positions: Float32Array): GeometryBounds {
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
