import { SLEDGEHAMMER_PROGRESSION } from '../items/sledgehammer/sledgehammer-progression';

/** 预分配旋风圆弧子步端点，避免高速帧在热路径创建临时对象。 */
export class BattlefieldHammerSpinArcSampler {
  public readonly startX = new Float32Array(
    SLEDGEHAMMER_PROGRESSION.spinMaximumSweepSubsteps,
  );
  public readonly startZ = new Float32Array(
    SLEDGEHAMMER_PROGRESSION.spinMaximumSweepSubsteps,
  );
  public readonly endX = new Float32Array(
    SLEDGEHAMMER_PROGRESSION.spinMaximumSweepSubsteps,
  );
  public readonly endZ = new Float32Array(
    SLEDGEHAMMER_PROGRESSION.spinMaximumSweepSubsteps,
  );
  private previousCenterX = 0;
  private previousCenterZ = 0;
  private currentCenterX = 0;
  private currentCenterZ = 0;
  private centerInitialized = false;

  /** 每帧记录玩家中心，使移动中的旋风同时插值圆心与锤头半径。 */
  public updateCenter(centerX: number, centerZ: number): void {
    if (this.centerInitialized) {
      this.previousCenterX = this.currentCenterX;
      this.previousCenterZ = this.currentCenterZ;
    } else {
      this.previousCenterX = centerX;
      this.previousCenterZ = centerZ;
      this.centerInitialized = true;
    }
    this.currentCenterX = centerX;
    this.currentCenterZ = centerZ;
  }

  /** 按本帧真实旋转角写出最多四段十五度级别的 Swept Capsule。 */
  public writeSegments(
    sweepStartX: number,
    sweepStartZ: number,
    sweepEndX: number,
    sweepEndZ: number,
    deltaSpinAngle: number,
  ): number {
    const config = SLEDGEHAMMER_PROGRESSION;
    const segmentCount = Math.max(1, Math.min(
      config.spinMaximumSweepSubsteps,
      Math.ceil(Math.abs(deltaSpinAngle) / config.spinSweepSubstepAngle),
    ));
    const startVectorX = sweepStartX - this.previousCenterX;
    const startVectorZ = sweepStartZ - this.previousCenterZ;
    const endVectorX = sweepEndX - this.currentCenterX;
    const endVectorZ = sweepEndZ - this.currentCenterZ;
    const startRadius = Math.hypot(startVectorX, startVectorZ);
    const endRadius = Math.hypot(endVectorX, endVectorZ);
    const startAngle = Math.atan2(startVectorX, startVectorZ);
    const expectedEndAngle = startAngle + deltaSpinAngle;
    const sampledEndAngle = Math.atan2(endVectorX, endVectorZ);
    const endCorrection = Math.atan2(
      Math.sin(sampledEndAngle - expectedEndAngle),
      Math.cos(sampledEndAngle - expectedEndAngle),
    );
    let previousX = sweepStartX;
    let previousZ = sweepStartZ;
    for (let index = 0; index < segmentCount; index++) {
      const progress = (index + 1) / segmentCount;
      const centerX = this.previousCenterX
        + (this.currentCenterX - this.previousCenterX) * progress;
      const centerZ = this.previousCenterZ
        + (this.currentCenterZ - this.previousCenterZ) * progress;
      const radius = startRadius + (endRadius - startRadius) * progress;
      const angle = startAngle + (deltaSpinAngle + endCorrection) * progress;
      const nextX = index === segmentCount - 1
        ? sweepEndX
        : centerX + Math.sin(angle) * radius;
      const nextZ = index === segmentCount - 1
        ? sweepEndZ
        : centerZ + Math.cos(angle) * radius;
      this.startX[index] = previousX;
      this.startZ[index] = previousZ;
      this.endX[index] = nextX;
      this.endZ[index] = nextZ;
      previousX = nextX;
      previousZ = nextZ;
    }
    return segmentCount;
  }

  public reset(): void {
    this.centerInitialized = false;
    this.previousCenterX = 0;
    this.previousCenterZ = 0;
    this.currentCenterX = 0;
    this.currentCenterZ = 0;
  }
}
