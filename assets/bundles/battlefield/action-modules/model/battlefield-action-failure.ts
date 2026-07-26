import { type BattlefieldActionReleaseSource } from './battlefield-action-release-source';

/** 玩家可见的抓取与投掷失败原因。 */
export enum BattlefieldActionFailureReason {
  None,
  TouchCancelled,
  TargetInvalid,
  OutOfRange,
  PathBlocked,
  BeginCarryRejected,
  InputBelowDeadZone,
  ThrowPathBlocked,
  BeginThrowRejected,
}

/** 保存最近一次动作失败与释放来源，供 Presentation 和 Debug 读取。 */
export class BattlefieldActionFailureState {
  private failure = BattlefieldActionFailureReason.None;
  private source: BattlefieldActionReleaseSource;
  private failureRevision = 1;

  constructor(initialReleaseSource: BattlefieldActionReleaseSource) {
    this.source = initialReleaseSource;
  }

  public get reason(): BattlefieldActionFailureReason {
    return this.failure;
  }

  public get releaseSource(): BattlefieldActionReleaseSource {
    return this.source;
  }

  public get revision(): number {
    return this.failureRevision;
  }

  /** 记录本次释放来源，但不覆盖更有价值的行为失败原因。 */
  public noteRelease(source: BattlefieldActionReleaseSource): void {
    this.source = source;
  }

  /** 写入新的玩家可见失败原因。 */
  public fail(reason: BattlefieldActionFailureReason): void {
    if (reason === BattlefieldActionFailureReason.None || this.failure === reason) {
      return;
    }
    this.failure = reason;
    this.invalidate();
  }

  /** 新动作开始或执行成功后清除上一条失败。 */
  public clear(): void {
    if (this.failure === BattlefieldActionFailureReason.None) {
      return;
    }
    this.failure = BattlefieldActionFailureReason.None;
    this.invalidate();
  }

  private invalidate(): void {
    this.failureRevision = this.failureRevision >= Number.MAX_SAFE_INTEGER
      ? 1
      : this.failureRevision + 1;
  }
}
