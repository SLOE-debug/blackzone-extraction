import { type MutableBattlefieldHammerWorldPose } from '../animation/battlefield-hammer-pose-solver';

/** 视觉锤头连续两帧之间的权威 Swept Capsule 状态。 */
export class BattlefieldHammerHeadSweepState {
  public previousX = 0;
  public previousY = 0;
  public previousZ = 0;
  public currentX = 0;
  public currentY = 0;
  public currentZ = 0;
  public radius = 0;
  private initialized = false;

  /** 写入渲染器同源锤头点；首帧退化为零长度胶囊。 */
  public synchronize(
    pose: Readonly<MutableBattlefieldHammerWorldPose>,
    radius: number,
  ): void {
    if (!Number.isFinite(pose.headX)
      || !Number.isFinite(pose.headY)
      || !Number.isFinite(pose.headZ)
      || !Number.isFinite(radius)
      || radius <= 0) {
      throw new Error('大锤锤头扫掠姿态或半径无效。');
    }
    if (this.initialized) {
      this.previousX = this.currentX;
      this.previousY = this.currentY;
      this.previousZ = this.currentZ;
    } else {
      this.previousX = pose.headX;
      this.previousY = pose.headY;
      this.previousZ = pose.headZ;
      this.initialized = true;
    }
    this.currentX = pose.headX;
    this.currentY = pose.headY;
    this.currentZ = pose.headZ;
    this.radius = radius;
  }

  public get ready(): boolean {
    return this.initialized;
  }

  /** 武器切换时移除上一件装备留下的连续扫掠端点。 */
  public reset(): void {
    this.previousX = 0;
    this.previousY = 0;
    this.previousZ = 0;
    this.currentX = 0;
    this.currentY = 0;
    this.currentZ = 0;
    this.radius = 0;
    this.initialized = false;
  }
}
