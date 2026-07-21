import { director, profiler } from 'cc';
import {
  type BattlefieldPerformanceSnapshot,
  presentBattlefieldPerformanceReport,
} from './battlefield-performance-console';

const LOG_INTERVAL_MILLISECONDS = 2000;

/** 战场每帧编排中需要独立观察的 CPU 阶段。 */
export enum BattlefieldPerformanceStage {
  Control,
  Player,
  Environment,
  WorldSynchronization,
  Weapon,
  Monsters,
  Status,
  Treasures,
  CameraAndInteraction,
  Count,
}

/** 两秒诊断窗口内需要累计次数或数值的离散事件。 */
export enum BattlefieldPerformanceEvent {
  ChunkTransition,
  ChunksAdded,
  ChunksRemoved,
  ChestOpened,
  LootReleased,
  EquipmentPicked,
  PlayerDamage,
  Count,
}

/** 日志模块只读依赖的战场运行时统计门面。 */
export interface BattlefieldPerformanceSources {
  readonly player: Readonly<{ positionX: number; positionZ: number }>;
  readonly chunks: Readonly<{ activeScopeCount: number }>;
  readonly environment: Readonly<{
    activeEntityCount: number;
    renderBatchCount: number;
    renderingSynchronizing: boolean;
  }>;
  readonly ground: Readonly<{ synchronizing: boolean }>;
  readonly monsters: Readonly<{ count: number; aliveCount: number; visibleCount: number }>;
  readonly treasures: Readonly<{
    activeChestCount: number;
    openedChestCount: number;
    droppedEquipmentCount: number;
    droppedRenderBatchCount: number;
  }>;
}

const STAGE_NAMES = Object.freeze([
  '输入与瞄准',
  '玩家动画移动',
  '环境与 Chunk',
  '地面补丁同步',
  '武器与弹体',
  '怪物群体',
  '状态 HUD',
  '宝箱与掉落物',
  '相机与交互',
]);

const EVENT_NAMES = Object.freeze([
  'Chunk 切换',
  '新增 Chunk',
  '移除 Chunk',
  '开启宝箱',
  '释放掉落物',
  '拾取装备',
  '玩家受伤量',
]);

/**
 * 以两秒为窗口累计战场各阶段耗时与事件。
 *
 * 高频路径只写 TypedArray，不创建对象或字符串；窗口结束时才读取引擎统计并输出
 * 一个按累计成本排序的折叠表格。
 */
export class BattlefieldPerformanceLogger {
  private readonly stageTotals = new Float64Array(BattlefieldPerformanceStage.Count);
  private readonly stageMaximums = new Float64Array(BattlefieldPerformanceStage.Count);
  private readonly stageSamples = new Uint32Array(BattlefieldPerformanceStage.Count);
  private readonly currentFrameStages = new Float64Array(BattlefieldPerformanceStage.Count);
  private readonly slowestFrameStages = new Float64Array(BattlefieldPerformanceStage.Count);
  private readonly eventValues = new Float64Array(BattlefieldPerformanceEvent.Count);
  private readonly currentFrameEvents = new Float64Array(BattlefieldPerformanceEvent.Count);
  private readonly slowestFrameEvents = new Float64Array(BattlefieldPerformanceEvent.Count);
  private readonly snapshot: BattlefieldPerformanceSnapshot = {
    playerX: 0,
    playerZ: 0,
    activeChunks: 0,
    environmentEntities: 0,
    environmentBatches: 0,
    environmentSynchronizing: false,
    groundSynchronizing: false,
    monsterSlots: 0,
    aliveMonsters: 0,
    visibleMonsters: 0,
    activeChests: 0,
    openedChests: 0,
    droppedEquipment: 0,
    droppedRenderBatches: 0,
  };
  private sources: Readonly<BattlefieldPerformanceSources> | null = null;
  private frameStarted = 0;
  private windowStarted = 0;
  private frameCount = 0;
  private updateTotal = 0;
  private updateMaximum = 0;
  private frameIntervalTotal = 0;
  private frameIntervalMaximum = 0;
  private previousConsoleOutputMilliseconds = 0;

  /** 初始化完成后绑定长期存在的只读统计门面。 */
  public bindSources(sources: Readonly<BattlefieldPerformanceSources>): void {
    if (this.sources !== null) {
      throw new Error('战场性能日志统计源只能绑定一次。');
    }
    this.sources = sources;
  }

  /** 开始记录一帧战场业务编排。 */
  public beginFrame(): void {
    const now = performance.now();
    if (this.windowStarted === 0) {
      this.windowStarted = now;
    }
    this.currentFrameStages.fill(0);
    this.currentFrameEvents.fill(0);
    this.frameStarted = now;
  }

  /** 返回一个无分配阶段时间戳。 */
  public beginStage(): number {
    return performance.now();
  }

  /** 把阶段开始时间累计为本窗口的总耗时、峰值和样本数。 */
  public endStage(stage: BattlefieldPerformanceStage, startedAt: number): void {
    if (stage < 0 || stage >= BattlefieldPerformanceStage.Count) {
      throw new Error('战场性能阶段标识越界。');
    }
    const elapsed = Math.max(0, performance.now() - startedAt);
    this.stageTotals[stage] = (this.stageTotals[stage] ?? 0) + elapsed;
    this.stageMaximums[stage] = Math.max(this.stageMaximums[stage] ?? 0, elapsed);
    this.stageSamples[stage] = (this.stageSamples[stage] ?? 0) + 1;
    this.currentFrameStages[stage] = (this.currentFrameStages[stage] ?? 0) + elapsed;
  }

  /** 累计窗口内一次事件或一份数值。 */
  public recordEvent(event: BattlefieldPerformanceEvent, value = 1): void {
    if (event < 0 || event >= BattlefieldPerformanceEvent.Count
      || !Number.isFinite(value) || value < 0) {
      throw new Error('战场性能事件标识或数值无效。');
    }
    this.eventValues[event] = (this.eventValues[event] ?? 0) + value;
    this.currentFrameEvents[event] = (this.currentFrameEvents[event] ?? 0) + value;
  }

  /** 完成本帧统计，并在达到两秒窗口时自行采集活动规模与输出。 */
  public endFrame(deltaTime: number): void {
    const now = performance.now();
    const updateElapsed = Math.max(0, now - this.frameStarted);
    const frameInterval = Math.max(0, deltaTime * 1000);
    this.updateTotal += updateElapsed;
    if (updateElapsed > this.updateMaximum) {
      this.updateMaximum = updateElapsed;
      this.slowestFrameStages.set(this.currentFrameStages);
      this.slowestFrameEvents.set(this.currentFrameEvents);
    }
    this.frameIntervalTotal += frameInterval;
    this.frameIntervalMaximum = Math.max(this.frameIntervalMaximum, frameInterval);
    this.frameCount++;
    if (now - this.windowStarted >= LOG_INTERVAL_MILLISECONDS) {
      this.captureAndFlush();
    }
  }

  /** 读取引擎上一帧提交统计，输出折叠表格并清空累计器。 */
  private flush(snapshot: Readonly<BattlefieldPerformanceSnapshot>): void {
    if (this.frameCount <= 0 || this.windowStarted === 0) {
      return;
    }
    const now = performance.now();
    const windowSeconds = (now - this.windowStarted) / 1000;
    const engineStats = profiler.stats;
    const device = director.root?.device;
    const drawCalls = device?.numDrawCalls
      ?? engineStats?.draws.counter.human()
      ?? -1;
    const triangles = device?.numTris
      ?? engineStats?.tricount.counter.human()
      ?? -1;
    const instances = device?.numInstances
      ?? engineStats?.instances.counter.human()
      ?? -1;
    const outputStarted = performance.now();
    presentBattlefieldPerformanceReport({
      windowSeconds,
      frameCount: this.frameCount,
      updateTotal: this.updateTotal,
      updateMaximum: this.updateMaximum,
      frameIntervalTotal: this.frameIntervalTotal,
      frameIntervalMaximum: this.frameIntervalMaximum,
      previousConsoleOutputMilliseconds: this.previousConsoleOutputMilliseconds,
      engineFrameMilliseconds: engineStats?.frame.counter.human(),
      engineLogicMilliseconds: engineStats?.logic.counter.human(),
      engineRendererMilliseconds: engineStats?.render.counter.human(),
      drawCalls,
      triangles,
      instances,
      stageNames: STAGE_NAMES,
      stageTotals: this.stageTotals,
      stageMaximums: this.stageMaximums,
      stageSamples: this.stageSamples,
      slowestFrameStages: this.slowestFrameStages,
      eventNames: EVENT_NAMES,
      eventValues: this.eventValues,
      slowestFrameEvents: this.slowestFrameEvents,
      snapshot,
    });
    this.previousConsoleOutputMilliseconds = performance.now() - outputStarted;
    this.reset(performance.now());
  }

  private captureAndFlush(): void {
    const sources = this.sources;
    if (sources === null) {
      throw new Error('战场性能日志尚未绑定统计源。');
    }
    const snapshot = this.snapshot;
    snapshot.playerX = sources.player.positionX;
    snapshot.playerZ = sources.player.positionZ;
    snapshot.activeChunks = sources.chunks.activeScopeCount;
    snapshot.environmentEntities = sources.environment.activeEntityCount;
    snapshot.environmentBatches = sources.environment.renderBatchCount;
    snapshot.environmentSynchronizing = sources.environment.renderingSynchronizing;
    snapshot.groundSynchronizing = sources.ground.synchronizing;
    snapshot.monsterSlots = sources.monsters.count;
    snapshot.aliveMonsters = sources.monsters.aliveCount;
    snapshot.visibleMonsters = sources.monsters.visibleCount;
    snapshot.activeChests = sources.treasures.activeChestCount;
    snapshot.openedChests = sources.treasures.openedChestCount;
    snapshot.droppedEquipment = sources.treasures.droppedEquipmentCount;
    snapshot.droppedRenderBatches = sources.treasures.droppedRenderBatchCount;
    this.flush(snapshot);
  }

  private reset(now: number): void {
    this.stageTotals.fill(0);
    this.stageMaximums.fill(0);
    this.stageSamples.fill(0);
    this.slowestFrameStages.fill(0);
    this.eventValues.fill(0);
    this.slowestFrameEvents.fill(0);
    this.windowStarted = now;
    this.frameCount = 0;
    this.updateTotal = 0;
    this.updateMaximum = 0;
    this.frameIntervalTotal = 0;
    this.frameIntervalMaximum = 0;
  }
}
