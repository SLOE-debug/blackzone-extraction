/** 表格输出所需的战场活动规模快照。 */
export interface BattlefieldPerformanceSnapshot {
  playerX: number;
  playerZ: number;
  activeChunks: number;
  environmentEntities: number;
  environmentBatches: number;
  environmentGeometryBytesAllocated: number;
  environmentBuilderReplacements: number;
  environmentSynchronizing: boolean;
  groundSynchronizing: boolean;
  monsterSlots: number;
  aliveMonsters: number;
  residentMonsters: number;
  visibleMonsters: number;
  monsterRenderCapacity: number;
  activeChests: number;
  openedChests: number;
  droppedEquipment: number;
  droppedRenderBatches: number;
}

/** 一次两秒窗口报告的只读表格数据。 */
export interface BattlefieldPerformanceConsoleReport {
  readonly windowSeconds: number;
  readonly frameCount: number;
  readonly updateTotal: number;
  readonly updateMaximum: number;
  readonly frameIntervalTotal: number;
  readonly frameIntervalMaximum: number;
  readonly previousConsoleOutputMilliseconds: number;
  readonly engineFrameMilliseconds: number | undefined;
  readonly engineLogicMilliseconds: number | undefined;
  readonly engineRendererMilliseconds: number | undefined;
  readonly drawCalls: number;
  readonly triangles: number;
  readonly instances: number;
  readonly stageNames: readonly string[];
  readonly stageTotals: Float64Array;
  readonly stageMaximums: Float64Array;
  readonly stageSamples: Uint32Array;
  readonly slowestFrameStages: Float64Array;
  readonly monsterStageNames: readonly string[];
  readonly monsterStageTotals: Float64Array;
  readonly monsterStageMaximums: Float64Array;
  readonly monsterStageSamples: Uint32Array;
  readonly slowestFrameMonsterStages: Float64Array;
  readonly slowestFrameVisibleMonsters: number;
  readonly slowestFrameMonsterRenderCapacity: number;
  readonly slowestFrameAliveMonsters: number;
  readonly monsterEntitiesEvaluatedTotal: number;
  readonly monsterPositionBytesUploadedTotal: number;
  readonly monsterPositionUploadCallsTotal: number;
  readonly eventNames: readonly string[];
  readonly eventValues: Float64Array;
  readonly slowestFrameEvents: Float64Array;
  readonly snapshot: Readonly<BattlefieldPerformanceSnapshot>;
}

interface BattlefieldPerformanceTableRow {
  阶段: string;
  '平均每帧(ms)': number;
  '该阶段峰值(ms)': number;
  '最慢update帧内(ms)': number;
  '窗口累计(ms)': number;
  '战场CPU占比': string;
  样本数: number;
}

interface BattlefieldMonsterPerformanceTableRow {
  子阶段: string;
  '平均每帧(ms)': number;
  '该子阶段峰值(ms)': number;
  '最慢update帧内(ms)': number;
  '窗口累计(ms)': number;
  '怪物阶段占比': string;
  样本数: number;
}

/**
 * 把一个诊断窗口压成单个折叠控制台组，并按窗口累计成本降序显示表格。
 *
 * 表格只在两秒窗口结束时创建，避免在逐帧路径分配行对象或排序数组。
 */
export function presentBattlefieldPerformanceReport(
  report: Readonly<BattlefieldPerformanceConsoleReport>,
): void {
  const rows = createSortedRows(report);
  const monsterRows = createSortedMonsterRows(report);
  console.groupCollapsed(createGroupTitle(report));
  try {
    console.table(rows);
    console.info('怪物群体细分（以下耗时已经包含在主表“怪物群体”中）');
    console.table(monsterRows);
    console.info(
      `怪物渲染工作量(平均每帧): 求值 ${formatAverage(
        report.monsterEntitiesEvaluatedTotal,
        report.frameCount,
      )} 只`
      + ` | Position ${formatBytes(
        report.monsterPositionBytesUploadedTotal / Math.max(report.frameCount, 1),
      )}`
      + ` | 上传调用 ${formatAverage(
        report.monsterPositionUploadCallsTotal,
        report.frameCount,
      )}`,
    );
    console.info(
      `窗口事件: ${formatEvents(report.eventNames, report.eventValues)}`
      + ` | 最慢 update 帧事件: ${formatEvents(
        report.eventNames,
        report.slowestFrameEvents,
      )}`
      + ` | 最慢 update 怪物: 可见${report.slowestFrameVisibleMonsters}`
      + `/批次容量${report.slowestFrameMonsterRenderCapacity}`
      + `/存活${report.slowestFrameAliveMonsters}`
      + ` | 上次表格输出 ${format(report.previousConsoleOutputMilliseconds)} ms`,
    );
    console.info(formatScale(report.snapshot));
  } finally {
    console.groupEnd();
  }
}

function createSortedMonsterRows(
  report: Readonly<BattlefieldPerformanceConsoleReport>,
): BattlefieldMonsterPerformanceTableRow[] {
  const rows: BattlefieldMonsterPerformanceTableRow[] = [];
  let monsterTotal = 0;
  for (let stage = 0; stage < report.monsterStageTotals.length; stage++) {
    monsterTotal += report.monsterStageTotals[stage] ?? 0;
  }
  for (let stage = 0; stage < report.monsterStageNames.length; stage++) {
    const total = report.monsterStageTotals[stage] ?? 0;
    const samples = report.monsterStageSamples[stage] ?? 0;
    rows.push({
      子阶段: report.monsterStageNames[stage] ?? String(stage),
      '平均每帧(ms)': round(samples > 0 ? total / samples : 0),
      '该子阶段峰值(ms)': round(report.monsterStageMaximums[stage] ?? 0),
      '最慢update帧内(ms)': round(report.slowestFrameMonsterStages[stage] ?? 0),
      '窗口累计(ms)': round(total),
      '怪物阶段占比': formatPercentage(total, monsterTotal),
      样本数: samples,
    });
  }
  rows.sort((left, right) => right['窗口累计(ms)'] - left['窗口累计(ms)']);
  return rows;
}

function createSortedRows(
  report: Readonly<BattlefieldPerformanceConsoleReport>,
): BattlefieldPerformanceTableRow[] {
  const rows: BattlefieldPerformanceTableRow[] = [];
  for (let stage = 0; stage < report.stageNames.length; stage++) {
    const total = report.stageTotals[stage] ?? 0;
    const samples = report.stageSamples[stage] ?? 0;
    rows.push({
      阶段: report.stageNames[stage] ?? String(stage),
      '平均每帧(ms)': round(samples > 0 ? total / samples : 0),
      '该阶段峰值(ms)': round(report.stageMaximums[stage] ?? 0),
      '最慢update帧内(ms)': round(report.slowestFrameStages[stage] ?? 0),
      '窗口累计(ms)': round(total),
      '战场CPU占比': formatPercentage(total, report.updateTotal),
      样本数: samples,
    });
  }
  rows.sort((left, right) => right['窗口累计(ms)'] - left['窗口累计(ms)']);
  return rows;
}

function createGroupTitle(report: Readonly<BattlefieldPerformanceConsoleReport>): string {
  const frameAverage = report.frameCount > 0
    ? report.frameIntervalTotal / report.frameCount
    : 0;
  const updateAverage = report.frameCount > 0
    ? report.updateTotal / report.frameCount
    : 0;
  return `[战场性能] ${format(report.windowSeconds)}s / ${report.frameCount}帧`
    + ` | update ${format(updateAverage)} / ${format(report.updateMaximum)} ms 平均/最慢`
    + ` | 帧间隔 ${format(frameAverage)} / ${format(report.frameIntervalMaximum)} ms`
    + ` | 引擎 Frame ${formatOptional(report.engineFrameMilliseconds)}`
    + ` Logic ${formatOptional(report.engineLogicMilliseconds)}`
    + ` Renderer ${formatOptional(report.engineRendererMilliseconds)} ms`
    + ` | DC ${formatInteger(report.drawCalls)}`
    + ` Tri ${formatInteger(report.triangles)}`
    + ` Inst ${formatInteger(report.instances)}`;
}

function formatEvents(names: readonly string[], values: Float64Array): string {
  const entries: string[] = [];
  for (let event = 0; event < names.length; event++) {
    const value = values[event] ?? 0;
    if (value > 0) {
      entries.push(`${names[event] ?? event}=${formatCompact(value)}`);
    }
  }
  return entries.length > 0 ? entries.join('，') : '无';
}

function formatScale(snapshot: Readonly<BattlefieldPerformanceSnapshot>): string {
  return `规模: 玩家(${format(snapshot.playerX, 1)}, ${format(snapshot.playerZ, 1)})`
    + ` | Chunk ${snapshot.activeChunks}`
    + ` | 环境实体 ${snapshot.environmentEntities}/批次${snapshot.environmentBatches}`
    + `/最近分配${formatBytes(snapshot.environmentGeometryBytesAllocated)}`
    + `/构建替换${snapshot.environmentBuilderReplacements}`
    + ` | 怪物 驻留${snapshot.residentMonsters}/视锥可见${snapshot.visibleMonsters}`
    + `/存活${snapshot.aliveMonsters}`
    + `/批次容量${snapshot.monsterRenderCapacity}/槽位${snapshot.monsterSlots}`
    + ` | 宝箱 ${snapshot.activeChests}(已开${snapshot.openedChests})`
    + ` | 掉落 ${snapshot.droppedEquipment}`
    + `(批次${snapshot.droppedRenderBatches})`
    + ` | 同步 环境${formatBoolean(snapshot.environmentSynchronizing)}`
    + `/地面${formatBoolean(snapshot.groundSynchronizing)}`;
}

function round(value: number): number {
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : 0;
}

function format(value: number, digits = 2): string {
  return Number.isFinite(value) ? value.toFixed(digits) : 'n/a';
}

function formatOptional(value: number | undefined): string {
  return value === undefined ? 'n/a' : format(value);
}

function formatCompact(value: number): string {
  return Number.isInteger(value) ? value.toString() : format(value, 1);
}

function formatAverage(total: number, count: number): string {
  return format(count > 0 ? total / count : 0, 1);
}

function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value < 0) {
    return 'n/a';
  }
  if (value >= 1024 * 1024) {
    return `${format(value / (1024 * 1024), 2)} MiB`;
  }
  return `${format(value / 1024, 1)} KiB`;
}

function formatInteger(value: number): string {
  return Number.isFinite(value) && value >= 0 ? Math.round(value).toString() : 'n/a';
}

function formatPercentage(value: number, total: number): string {
  return total > 0 ? `${format(value / total * 100, 1)}%` : '0.0%';
}

function formatBoolean(value: boolean): string {
  return value ? '是' : '否';
}
