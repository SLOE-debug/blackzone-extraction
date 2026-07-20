/** 提供连续 Geometry 当前写入游标的最小契约。 */
export interface GeometrySectionCursor {
  readonly vertexCount: number;
  readonly indexCount: number;
}

/** 一个语义区段在合并 Geometry 中占用的连续顶点与索引范围。 */
export interface GeometrySectionRange {
  readonly startVertex: number;
  readonly vertexCount: number;
  readonly startIndex: number;
  readonly indexCount: number;
}

/** 类型化语义区段到连续 Geometry 范围的完整映射。 */
export type GeometrySectionMap<TSection extends string> = Readonly<
  Record<TSection, GeometrySectionRange>
>;

/**
 * 在 Geometry 写入过程中记录类型化语义区段。
 *
 * Section 只描述内容语义和连续范围，不负责 Material、Mesh 或 Draw Call。
 */
export class GeometrySectionComposer<TSection extends string> {
  private readonly ranges = new Map<TSection, GeometrySectionRange>();

  constructor(private readonly cursor: GeometrySectionCursor) {}

  /**
   * 执行一次 Geometry 写入并记录其顶点和索引范围。
   *
   * @param section 不允许重复写入的类型化区段标识。
   * @param appendGeometry 只负责追加当前区段 Geometry 的回调。
   * @returns 当前区段冻结后的连续范围。
   */
  public write(section: TSection, appendGeometry: () => void): GeometrySectionRange {
    if (this.ranges.has(section)) {
      throw new Error(`Geometry 语义区段重复写入：${section}`);
    }
    const startVertex = this.cursor.vertexCount;
    const startIndex = this.cursor.indexCount;
    appendGeometry();
    const range = Object.freeze({
      startVertex,
      vertexCount: this.cursor.vertexCount - startVertex,
      startIndex,
      indexCount: this.cursor.indexCount - startIndex,
    });
    this.ranges.set(section, range);
    return range;
  }

  /** 获取已经完成写入的单个语义区段。 */
  public get(section: TSection): GeometrySectionRange {
    const range = this.ranges.get(section);
    if (range === undefined) {
      throw new Error(`Geometry 语义区段尚未写入：${section}`);
    }
    return range;
  }

  /**
   * 按调用方声明的稳定顺序生成完整只读区段映射。
   *
   * 缺少区段、重复声明或存在未列出的额外区段都会直接报错，避免着色偏移静默错位。
   */
  public toRecord(sections: readonly TSection[]): GeometrySectionMap<TSection> {
    const record: Partial<Record<TSection, GeometrySectionRange>> = {};
    const declared = new Set<TSection>();
    for (const section of sections) {
      if (declared.has(section)) {
        throw new Error(`Geometry 语义区段顺序包含重复项：${section}`);
      }
      declared.add(section);
      record[section] = this.get(section);
    }
    if (declared.size !== this.ranges.size) {
      throw new Error('Geometry 语义区段顺序没有覆盖全部已写入区段。');
    }
    return Object.freeze(record) as GeometrySectionMap<TSection>;
  }
}
