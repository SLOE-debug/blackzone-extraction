/** 技能键释放后产生的互斥特殊攻击命令。 */
export enum BattlefieldWeaponSpecialCommand {
  None,
  Uppercut,
  Spin,
}

/** 输入与武器行为运行时之间的无分配单玩家命令缓冲。 */
export class BattlefieldWeaponCommandBuffer {
  private swingRequested = false;
  private swingDirectionX = 0;
  private swingDirectionZ = 1;
  private swingStartsRight: boolean | null = null;
  private specialCommand = BattlefieldWeaponSpecialCommand.None;

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
    this.specialCommand = BattlefieldWeaponSpecialCommand.Uppercut;
  }

  public requestSpin(): void {
    this.specialCommand = BattlefieldWeaponSpecialCommand.Spin;
  }

  /** 特殊命令优先于同帧普通挥动，消费后立即清空一次性状态。 */
  public consume(result: MutableBattlefieldWeaponCommand): void {
    result.swingRequested = this.swingRequested;
    result.directionX = this.swingDirectionX;
    result.directionZ = this.swingDirectionZ;
    result.startsRight = this.swingStartsRight;
    result.special = this.specialCommand;
    this.swingRequested = false;
    this.specialCommand = BattlefieldWeaponSpecialCommand.None;
  }
}

export interface MutableBattlefieldWeaponCommand {
  swingRequested: boolean;
  directionX: number;
  directionZ: number;
  startsRight: boolean | null;
  special: BattlefieldWeaponSpecialCommand;
}

function validateDirection(directionX: number, directionZ: number): void {
  if (!Number.isFinite(directionX) || !Number.isFinite(directionZ)
    || Math.abs(Math.hypot(directionX, directionZ) - 1) > 0.001) {
    throw new Error('武器命令方向必须为有限单位向量。');
  }
}
