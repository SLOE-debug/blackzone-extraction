import { type BattlefieldTetherQuery } from '../equipment/projectile/model/battlefield-arrow-query';

const TETHER_DEBUG_INTERVAL_MILLISECONDS = 2000;
const TETHER_DEBUG_EPSILON = 0.000001;

/**
 * 聚合弦线空间查询的分层诊断数据，并按固定时间窗口输出。
 *
 * 高频采样阶段只修改标量；仅在窗口结束时创建日志对象。
 */
export class BattlefieldTetherOverlapDebugAggregate {
  private windowStartedAt: number;

  private queryCount = 0;
  private broadPhaseCandidateCount = 0;
  private lifecycleRejectedCount = 0;
  private planarRejectedCount = 0;
  private verticalRejectedCount = 0;
  private acceptedCount = 0;
  private zeroCandidateQueryCount = 0;

  private closestVerticalGap = Number.POSITIVE_INFINITY;
  private samplePopulationId = -1;
  private sampleEntityId = -1;
  private sampleLineY = 0;
  private sampleMinimumY = 0;
  private sampleMaximumY = 0;
  private samplePlanarDistance = 0;
  private sampleContactRadius = 0;
  private sampleProgress = 0;

  /**
   * 创建默认关闭的诊断聚合器。
   *
   * @param enabled 仅由开发环境诊断入口显式开启，生产查询不得传入 true。
   */
  constructor(private readonly enabled = false) {
    this.windowStartedAt = enabled ? performance.now() : 0;
  }

  /** 记录一次查询及其宽相位候选数量。 */
  public beginQuery(candidateCount: number): void {
    if (!this.enabled) {
      return;
    }

    this.queryCount++;
    this.broadPhaseCandidateCount += candidateCount;
    if (candidateCount === 0) {
      this.zeroCandidateQueryCount++;
    }
  }

  /** 记录一个因群体缺失、生命周期或参与状态被拒绝的候选。 */
  public rejectLifecycle(): void {
    if (this.enabled) {
      this.lifecycleRejectedCount++;
    }
  }

  /**
   * 对候选执行仅用于诊断的分层分类，并保留最接近命中的 Y 轴漏判样本。
   */
  public observeCandidate(
    populationId: number,
    entityId: number,
    query: Readonly<BattlefieldTetherQuery>,
    targetX: number,
    targetZ: number,
    minimumY: number,
    maximumY: number,
    contactRadius: number,
    actualProgress: number,
  ): void {
    if (!this.enabled) {
      return;
    }

    const segmentX = query.endX - query.startX;
    const segmentY = query.endY - query.startY;
    const segmentZ = query.endZ - query.startZ;
    const planarLengthSquared = segmentX * segmentX + segmentZ * segmentZ;
    const projectedProgress = planarLengthSquared <= TETHER_DEBUG_EPSILON
      ? 0
      : Math.max(0, Math.min(1, (
        (targetX - query.startX) * segmentX
        + (targetZ - query.startZ) * segmentZ
      ) / planarLengthSquared));
    const nearestX = query.startX + segmentX * projectedProgress;
    const nearestZ = query.startZ + segmentZ * projectedProgress;
    const deltaX = targetX - nearestX;
    const deltaZ = targetZ - nearestZ;
    const planarDistanceSquared = deltaX * deltaX + deltaZ * deltaZ;

    if (planarDistanceSquared > contactRadius * contactRadius) {
      this.planarRejectedCount++;
      return;
    }

    const lineY = query.startY + segmentY * projectedProgress;
    if (actualProgress >= 0) {
      this.acceptedCount++;
      return;
    }

    this.verticalRejectedCount++;
    const verticalGap = lineY < minimumY
      ? minimumY - lineY
      : lineY > maximumY
        ? lineY - maximumY
        : 0;
    if (verticalGap >= this.closestVerticalGap) {
      return;
    }

    this.closestVerticalGap = verticalGap;
    this.samplePopulationId = populationId;
    this.sampleEntityId = entityId;
    this.sampleLineY = lineY;
    this.sampleMinimumY = minimumY;
    this.sampleMaximumY = maximumY;
    this.samplePlanarDistance = Math.sqrt(planarDistanceSquared);
    this.sampleContactRadius = contactRadius;
    this.sampleProgress = projectedProgress;
  }

  /** 到达两秒窗口时输出聚合结果并开始新窗口。 */
  public flushIfDue(): void {
    if (!this.enabled) {
      return;
    }

    const now = performance.now();
    const elapsed = now - this.windowStartedAt;
    if (elapsed < TETHER_DEBUG_INTERVAL_MILLISECONDS) {
      return;
    }

    console.groupCollapsed(
      `[TetherOverlap 2s] accepted=${this.acceptedCount}, `
      + `verticalRejected=${this.verticalRejectedCount}, `
      + `planarRejected=${this.planarRejectedCount}`,
    );
    console.table([{
      '窗口毫秒': Math.round(elapsed),
      '弦线查询数': this.queryCount,
      '宽相位候选数': this.broadPhaseCandidateCount,
      '零候选查询数': this.zeroCandidateQueryCount,
      '生命周期拒绝': this.lifecycleRejectedCount,
      '平面距离拒绝': this.planarRejectedCount,
      'Y轴高度拒绝': this.verticalRejectedCount,
      '最终重叠命中': this.acceptedCount,
    }]);

    if (this.sampleEntityId >= 0) {
      console.table([{
        '最近Y轴漏判 population': this.samplePopulationId,
        'entity': this.sampleEntityId,
        '激光Y': this.round(this.sampleLineY),
        '足部范围最低Y': this.round(this.sampleMinimumY),
        '身体顶部最高Y': this.round(this.sampleMaximumY),
        'Y轴差距': this.round(this.closestVerticalGap),
        'XZ中心到线距离': this.round(this.samplePlanarDistance),
        'XZ允许半径': this.round(this.sampleContactRadius),
        '线段进度': this.round(this.sampleProgress),
      }]);
    }

    console.groupEnd();
    this.reset(now);
  }

  private reset(now: number): void {
    this.windowStartedAt = now;
    this.queryCount = 0;
    this.broadPhaseCandidateCount = 0;
    this.lifecycleRejectedCount = 0;
    this.planarRejectedCount = 0;
    this.verticalRejectedCount = 0;
    this.acceptedCount = 0;
    this.zeroCandidateQueryCount = 0;
    this.closestVerticalGap = Number.POSITIVE_INFINITY;
    this.samplePopulationId = -1;
    this.sampleEntityId = -1;
    this.sampleLineY = 0;
    this.sampleMinimumY = 0;
    this.sampleMaximumY = 0;
    this.samplePlanarDistance = 0;
    this.sampleContactRadius = 0;
    this.sampleProgress = 0;
  }

  private round(value: number): number {
    return Math.round(value * 1000) / 1000;
  }
}
