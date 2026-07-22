/** 空间索引查询写入的固定容量候选实体缓冲。 */
export class PlanarCrowdCandidateBuffer {
  public readonly populationIds: Uint32Array;
  public readonly entityIndices: Uint32Array;
  private candidateCount = 0;

  constructor(public readonly capacity: number) {
    if (!Number.isSafeInteger(capacity) || capacity <= 0) {
      throw new Error('Crowd 候选缓冲容量必须是正整数。');
    }
    this.populationIds = new Uint32Array(capacity);
    this.entityIndices = new Uint32Array(capacity);
  }

  public get count(): number {
    return this.candidateCount;
  }

  /** 开始一次查询并复用原有 TypedArray。 */
  public reset(): void {
    this.candidateCount = 0;
  }

  /** 追加稳定候选；DDA 扩张邻域重复访问同一实体时原地去重。 */
  public include(populationId: number, entityIndex: number): void {
    for (let index = 0; index < this.candidateCount; index++) {
      if ((this.populationIds[index] ?? 0) === populationId
        && (this.entityIndices[index] ?? 0) === entityIndex) {
        return;
      }
    }
    if (this.candidateCount >= this.capacity) {
      throw new Error('Crowd 候选缓冲容量不足。');
    }
    this.populationIds[this.candidateCount] = populationId;
    this.entityIndices[this.candidateCount] = entityIndex;
    this.candidateCount++;
  }
}
