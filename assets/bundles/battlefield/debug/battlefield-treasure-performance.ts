/** 宝箱开启与掉落渲染热路径中的独立性能区段。 */
export enum BattlefieldTreasurePerformanceSection {
  TreasureOpenRollLoot,
  TreasureSessionWrite,
  TreasureScatterBuild,
  TreasureDropSpawn,
  DroppedBodyUpload,
  DroppedAccentUpload,
  DroppedBoundsUpdate,
  DroppedFirstVisible,
  Count,
}

export const BATTLEFIELD_TREASURE_PERFORMANCE_SECTION_NAMES = Object.freeze([
  '开箱抽取战利品',
  '开箱会话写入',
  '掉落轨迹构造',
  '掉落槽位生成',
  '掉落本体上传',
  '掉落信标上传',
  '掉落包围盒更新',
  '掉落批次首次可见',
]);

/** 宝箱与掉落模块只依赖的无分配性能记录门面。 */
export interface BattlefieldTreasurePerformanceRecorder {
  beginTreasureSection(recordWhileDiagnosticsDisabled?: boolean): number;
  endTreasureSection(
    section: BattlefieldTreasurePerformanceSection,
    startedAt: number,
    uploadedVertices?: number,
    uploadedBytes?: number,
    activeDropCount?: number,
    firstVisibleBatch?: boolean,
  ): void;
}

/** 持有八类宝箱热路径指标，避免扩张总性能日志的职责。 */
export class BattlefieldTreasurePerformanceMetrics {
  public readonly totals = new Float64Array(BattlefieldTreasurePerformanceSection.Count);
  public readonly maximums = new Float64Array(BattlefieldTreasurePerformanceSection.Count);
  public readonly samples = new Uint32Array(BattlefieldTreasurePerformanceSection.Count);
  public readonly uploadedVertices = new Float64Array(
    BattlefieldTreasurePerformanceSection.Count,
  );
  public readonly uploadedBytes = new Float64Array(BattlefieldTreasurePerformanceSection.Count);
  public readonly maximumActiveDrops = new Uint32Array(
    BattlefieldTreasurePerformanceSection.Count,
  );
  public readonly firstVisibleBatches = new Uint32Array(
    BattlefieldTreasurePerformanceSection.Count,
  );

  public record(
    section: BattlefieldTreasurePerformanceSection,
    elapsed: number,
    uploadedVertices: number,
    uploadedBytes: number,
    activeDropCount: number,
    firstVisibleBatch: boolean,
  ): void {
    if (section < 0 || section >= BattlefieldTreasurePerformanceSection.Count
      || !Number.isFinite(elapsed) || elapsed < 0
      || !Number.isSafeInteger(uploadedVertices) || uploadedVertices < 0
      || !Number.isSafeInteger(uploadedBytes) || uploadedBytes < 0
      || !Number.isSafeInteger(activeDropCount) || activeDropCount < 0) {
      throw new Error('宝箱性能区段指标无效。');
    }
    this.totals[section] = (this.totals[section] ?? 0) + elapsed;
    this.maximums[section] = Math.max(this.maximums[section] ?? 0, elapsed);
    this.samples[section] = (this.samples[section] ?? 0) + 1;
    this.uploadedVertices[section] = (this.uploadedVertices[section] ?? 0)
      + uploadedVertices;
    this.uploadedBytes[section] = (this.uploadedBytes[section] ?? 0) + uploadedBytes;
    this.maximumActiveDrops[section] = Math.max(
      this.maximumActiveDrops[section] ?? 0,
      activeDropCount,
    );
    if (firstVisibleBatch) {
      this.firstVisibleBatches[section] = (this.firstVisibleBatches[section] ?? 0) + 1;
    }
  }

  public reset(): void {
    this.totals.fill(0);
    this.maximums.fill(0);
    this.samples.fill(0);
    this.uploadedVertices.fill(0);
    this.uploadedBytes.fill(0);
    this.maximumActiveDrops.fill(0);
    this.firstVisibleBatches.fill(0);
  }
}
