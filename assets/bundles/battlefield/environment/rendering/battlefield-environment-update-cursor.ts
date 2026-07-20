/** 一个环境原型区段的实体与单实体顶点计数。 */
export interface BattlefieldEnvironmentUpdateSection {
  readonly entityCount: number;
  readonly verticesPerEntity: number;
}

/** 每帧环境求值器复用的连续实体任务。 */
export interface MutableBattlefieldEnvironmentUpdateRange {
  sectionIndex: number;
  firstEntity: number;
  entityCount: number;
  vertexCount: number;
}

/** 按顶点预算把完整环境大网格求值拆成多个无分配连续任务。 */
export class BattlefieldEnvironmentUpdateCursor {
  private sectionIndex = 0;
  private firstEntity = 0;
  private pending = false;

  constructor(
    private readonly sections: readonly Readonly<BattlefieldEnvironmentUpdateSection>[],
  ) {
    if (sections.length === 0) {
      throw new Error('环境更新游标至少需要一个原型区段。');
    }
    for (const section of sections) {
      if (!Number.isInteger(section.entityCount) || section.entityCount <= 0
        || !Number.isInteger(section.verticesPerEntity)
        || section.verticesPerEntity <= 0) {
        throw new Error('环境更新区段必须使用正整数实体数和单实体顶点数。');
      }
    }
  }

  /** 当前是否仍有未完成的 CPU 顶点求值任务。 */
  public get active(): boolean {
    return this.pending;
  }

  /** 放弃旧进度并从第一个原型区段重新开始。 */
  public restart(): void {
    this.sectionIndex = 0;
    this.firstEntity = 0;
    this.pending = true;
  }

  /** 写出一个不超过预算的连续任务；单实体超过预算时仍保证至少推进一个实体。 */
  public writeNext(
    maximumVertices: number,
    target: MutableBattlefieldEnvironmentUpdateRange,
  ): boolean {
    if (!Number.isInteger(maximumVertices) || maximumVertices <= 0) {
      throw new Error('环境单帧顶点预算必须是正整数。');
    }
    if (!this.pending) {
      return false;
    }
    while (this.sectionIndex < this.sections.length) {
      const section = this.sections[this.sectionIndex];
      if (section === undefined) {
        throw new Error('环境更新游标指向了不存在的区段。');
      }
      const remainingEntities = section.entityCount - this.firstEntity;
      if (remainingEntities <= 0) {
        this.sectionIndex += 1;
        this.firstEntity = 0;
        continue;
      }
      const entityCount = Math.min(
        remainingEntities,
        Math.max(1, Math.floor(maximumVertices / section.verticesPerEntity)),
      );
      target.sectionIndex = this.sectionIndex;
      target.firstEntity = this.firstEntity;
      target.entityCount = entityCount;
      target.vertexCount = entityCount * section.verticesPerEntity;
      this.firstEntity += entityCount;
      if (this.firstEntity >= section.entityCount) {
        this.sectionIndex += 1;
        this.firstEntity = 0;
      }
      if (this.sectionIndex >= this.sections.length) {
        this.pending = false;
      }
      return true;
    }
    this.pending = false;
    return false;
  }
}
