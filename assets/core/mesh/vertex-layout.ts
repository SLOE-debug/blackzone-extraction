/** 动态 SoA 顶点流的领域语义。 */
export enum VertexSemantic {
  Position = 'positions',
  Normal = 'normals',
  Color = 'colors',
}

/** 核心层当前支持的顶点布局标识。 */
export enum VertexLayoutId {
  LitColor = 'lit-color',
  UnlitColor = 'unlit-color',
}

/** 各顶点语义对应的分量宽度。 */
export interface VertexSemanticComponentMap {
  readonly [VertexSemantic.Position]: 3;
  readonly [VertexSemantic.Normal]: 3;
  readonly [VertexSemantic.Color]: 4;
}

/** 一个顶点语义对应的分量宽度。 */
export type VertexComponentCount<TSemantic extends VertexSemantic> =
  VertexSemanticComponentMap[TSemantic];

/** 精确包含指定语义的 SoA 顶点流集合。 */
export type VertexStreams<
  TSemantics extends VertexSemantic = LitColorVertexSemantic,
> = Readonly<{
  [TSemantic in TSemantics]: Float32Array;
}>;

/** 受光顶点颜色布局的语义集合。 */
export type LitColorVertexSemantic =
  | VertexSemantic.Position
  | VertexSemantic.Normal
  | VertexSemantic.Color;

/** 无光顶点颜色布局的语义集合。 */
export type UnlitColorVertexSemantic =
  | VertexSemantic.Position
  | VertexSemantic.Color;

/**
 * 描述一组有序、精确的 SoA 顶点语义。
 *
 * 语义顺序同时定义 Cocos 动态网格的顶点缓冲顺序，不允许由调用点另行配置。
 */
export interface VertexLayout<TSemantics extends VertexSemantic> {
  readonly id: VertexLayoutId;
  readonly semantics: readonly TSemantics[];

  /** 为固定顶点容量创建该布局要求的全部流。 */
  createStreams(vertexCount: number): VertexStreams<TSemantics>;
}

/** 位置、法线和颜色组成的受光动态布局。 */
export const LIT_COLOR_LAYOUT = defineVertexLayout(
  VertexLayoutId.LitColor,
  [VertexSemantic.Position, VertexSemantic.Normal, VertexSemantic.Color] as const,
);

/** 位置和颜色组成的无光动态布局。 */
export const UNLIT_COLOR_LAYOUT = defineVertexLayout(
  VertexLayoutId.UnlitColor,
  [VertexSemantic.Position, VertexSemantic.Color] as const,
);

/** 返回指定顶点语义的固定分量宽度。 */
export function getVertexComponentCount<TSemantic extends VertexSemantic>(
  semantic: TSemantic,
): VertexComponentCount<TSemantic> {
  switch (semantic) {
    case VertexSemantic.Position:
    case VertexSemantic.Normal:
      return 3 as VertexComponentCount<TSemantic>;
    case VertexSemantic.Color:
      return 4 as VertexComponentCount<TSemantic>;
  }
}

/** 定义并冻结一个能够创建精确 SoA 流集合的顶点布局。 */
function defineVertexLayout<const TSemantics extends readonly VertexSemantic[]>(
  id: VertexLayoutId,
  semantics: TSemantics,
): VertexLayout<TSemantics[number]> {
  if (semantics.length === 0 || new Set(semantics).size !== semantics.length) {
    throw new Error('顶点布局必须包含互不重复的语义。');
  }

  return Object.freeze({
    id,
    semantics: Object.freeze([...semantics]),
    createStreams(vertexCount: number): VertexStreams<TSemantics[number]> {
      if (!Number.isInteger(vertexCount) || vertexCount <= 0) {
        throw new Error('顶点流容量必须是正整数。');
      }

      const streams: Partial<Record<VertexSemantic, Float32Array>> = {};
      for (const semantic of semantics) {
        streams[semantic] = new Float32Array(
          vertexCount * getVertexComponentCount(semantic),
        );
      }
      return Object.freeze(streams) as VertexStreams<TSemantics[number]>;
    },
  });
}
