/** 输入与武器行为运行时之间的无分配单玩家命令缓冲。 */
export class BattlefieldWeaponCommandBuffer {
  private attackHeld = false;
  private swingRequested = false;
  private swingDirectionX = 0;
  private swingDirectionZ = 1;
  private swingStartsRight: boolean | null = null;
  private groundSlamRequested = false;
  private groundSlamDirectionX = 0;
  private groundSlamDirectionZ = 1;
  private spinRequested = false;
  private recallAllRequested = false;
  private huntingTetherRequested = false;

  /** 每帧同步普通攻击的持续意图，供状态机决定是否进入下一段。 */
  public setAttackHeld(held: boolean): void {
    this.attackHeld = held;
  }

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

  public requestGroundSlam(directionX: number, directionZ: number): void {
    validateDirection(directionX, directionZ);
    this.groundSlamRequested = true;
    this.groundSlamDirectionX = directionX;
    this.groundSlamDirectionZ = directionZ;
  }

  public requestSpin(): void {
    this.spinRequested = true;
  }

  public requestRecallAll(): void {
    this.recallAllRequested = true;
  }

  public requestHuntingTether(): void {
    this.huntingTetherRequested = true;
  }

  /** 两路主动技能命令独立复制，消费后立即清空全部一次性状态。 */
  public consume(result: MutableBattlefieldWeaponCommand): void {
    result.attackHeld = this.attackHeld;
    result.swingRequested = this.swingRequested;
    result.directionX = this.swingDirectionX;
    result.directionZ = this.swingDirectionZ;
    result.startsRight = this.swingStartsRight;
    result.groundSlamRequested = this.groundSlamRequested;
    result.groundSlamDirectionX = this.groundSlamDirectionX;
    result.groundSlamDirectionZ = this.groundSlamDirectionZ;
    result.spinRequested = this.spinRequested;
    result.recallAllRequested = this.recallAllRequested;
    result.huntingTetherRequested = this.huntingTetherRequested;
    this.clearRequests();
  }

  /** 卸下武器或玩家失效时丢弃尚未消费的一次性命令。 */
  public clear(): void {
    this.attackHeld = false;
    this.clearRequests();
  }

  private clearRequests(): void {
    this.swingRequested = false;
    this.groundSlamRequested = false;
    this.spinRequested = false;
    this.recallAllRequested = false;
    this.huntingTetherRequested = false;
  }
}

export interface MutableBattlefieldWeaponCommand {
  attackHeld: boolean;
  swingRequested: boolean;
  directionX: number;
  directionZ: number;
  startsRight: boolean | null;
  groundSlamRequested: boolean;
  groundSlamDirectionX: number;
  groundSlamDirectionZ: number;
  spinRequested: boolean;
  recallAllRequested: boolean;
  huntingTetherRequested: boolean;
}

function validateDirection(directionX: number, directionZ: number): void {
  if (!Number.isFinite(directionX) || !Number.isFinite(directionZ)
    || Math.abs(Math.hypot(directionX, directionZ) - 1) > 0.001) {
    throw new Error('武器命令方向必须为有限单位向量。');
  }
}
