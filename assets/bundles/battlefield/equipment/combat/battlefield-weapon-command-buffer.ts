/** 输入与武器行为运行时之间的无分配单玩家命令缓冲。 */
export class BattlefieldWeaponCommandBuffer {
  private swingRequested = false;
  private swingDirectionX = 0;
  private swingDirectionZ = 1;
  private swingStartsRight: boolean | null = null;
  private uppercutRequested = false;
  private groundSlamRequested = false;
  private spinRequested = false;

  public requestSwing(
    directionX: number,
    directionZ: number,
    startsRight: boolean | null = null,
  ): void {
    validateDirection(directionX, directionZ);
    this.swingRequested = true;
    this.swingDirectionX = directionX;
    this.swingDirectionZ = directionZ;
    this.swingStartsRight = startsRight;
  }

  public requestUppercut(): void {
    this.uppercutRequested = true;
  }

  public requestGroundSlam(): void {
    this.groundSlamRequested = true;
  }

  public requestSpin(): void {
    this.spinRequested = true;
  }

  /** 三路特殊命令独立复制，消费后立即清空全部一次性状态。 */
  public consume(result: MutableBattlefieldWeaponCommand): void {
    result.swingRequested = this.swingRequested;
    result.directionX = this.swingDirectionX;
    result.directionZ = this.swingDirectionZ;
    result.startsRight = this.swingStartsRight;
    result.uppercutRequested = this.uppercutRequested;
    result.groundSlamRequested = this.groundSlamRequested;
    result.spinRequested = this.spinRequested;
    this.clear();
  }

  /** 卸下武器或玩家失效时丢弃尚未消费的一次性命令。 */
  public clear(): void {
    this.swingRequested = false;
    this.uppercutRequested = false;
    this.groundSlamRequested = false;
    this.spinRequested = false;
  }
}

export interface MutableBattlefieldWeaponCommand {
  swingRequested: boolean;
  directionX: number;
  directionZ: number;
  startsRight: boolean | null;
  uppercutRequested: boolean;
  groundSlamRequested: boolean;
  spinRequested: boolean;
}

function validateDirection(directionX: number, directionZ: number): void {
  if (!Number.isFinite(directionX) || !Number.isFinite(directionZ)
    || Math.abs(Math.hypot(directionX, directionZ) - 1) > 0.001) {
    throw new Error('武器命令方向必须为有限单位向量。');
  }
}
