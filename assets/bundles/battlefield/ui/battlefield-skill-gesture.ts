import { BattlefieldActionReleaseSource } from '../action-modules/model/battlefield-action-release-source';

/** 技能轮盘向世界输入层暴露的无模块手势状态。 */
export interface MutableBattlefieldSkillGestureInput {
  active: boolean;
  released: boolean;
  releaseSource: BattlefieldActionReleaseSource;
  x: number;
  y: number;
  amplitude: number;
}

/**
 * 独立管理触摸所有权和唯一释放快照。
 *
 * `TOUCH_CANCEL` 代表 Cocos 触摸链被转移，不等同于玩家主动取消技能，因此仍按最后有效轴释放。
 */
export class BattlefieldSkillGesture {
  private touchId: number | null = null;
  private keyboardActive = false;
  private released = false;
  private releaseSource = BattlefieldActionReleaseSource.None;
  private releasedX = 0;
  private releasedY = 0;
  private releasedAmplitude = 0;

  public get active(): boolean {
    return this.touchId !== null || this.keyboardActive;
  }

  public ownsTouch(touchId: number): boolean {
    return this.touchId === touchId;
  }

  /** 第一根命中的手指获得本次技能手势所有权。 */
  public beginTouch(touchId: number): boolean {
    if (!Number.isSafeInteger(touchId)
      || this.touchId !== null
      || this.keyboardActive
      || this.released) {
      return false;
    }
    this.touchId = touchId;
    return true;
  }

  /** 所有者正常结束或被 Cocos 取消时都生成一次可消费释放。 */
  public releaseTouch(
    touchId: number,
    source: BattlefieldActionReleaseSource.TouchEnd | BattlefieldActionReleaseSource.TouchCancel,
    x: number,
    y: number,
    amplitude: number,
  ): boolean {
    if (!this.ownsTouch(touchId)) {
      return false;
    }
    this.queueRelease(source, x, y, amplitude);
    this.touchId = null;
    return true;
  }

  /** 键盘松开与触摸共用同一份释放快照契约。 */
  public setKeyboardActive(
    active: boolean,
    x: number,
    y: number,
    amplitude: number,
  ): boolean {
    if (this.keyboardActive === active) {
      return false;
    }
    if (active && (this.touchId !== null || this.released)) {
      return false;
    }
    this.keyboardActive = active;
    if (!active) {
      this.queueRelease(BattlefieldActionReleaseSource.Keyboard, x, y, amplitude);
    }
    return true;
  }

  /** 复制持续状态或唯一释放快照，并只清除释放标记。 */
  public consume(
    result: MutableBattlefieldSkillGestureInput,
    x: number,
    y: number,
    amplitude: number,
  ): void {
    result.active = this.active;
    result.released = this.released;
    result.releaseSource = this.released
      ? this.releaseSource
      : BattlefieldActionReleaseSource.None;
    result.x = this.released ? this.releasedX : x;
    result.y = this.released ? this.releasedY : y;
    result.amplitude = this.released ? this.releasedAmplitude : amplitude;
    this.released = false;
    this.releaseSource = BattlefieldActionReleaseSource.None;
  }

  /** 界面上下文销毁或切换时执行真正取消，不产生动作释放。 */
  public cancel(): void {
    this.touchId = null;
    this.keyboardActive = false;
    this.released = false;
    this.releaseSource = BattlefieldActionReleaseSource.None;
  }

  private queueRelease(
    source: BattlefieldActionReleaseSource,
    x: number,
    y: number,
    amplitude: number,
  ): void {
    if (![x, y, amplitude].every(Number.isFinite) || amplitude < 0 || amplitude > 1) {
      throw new Error('技能释放快照必须使用有限轴值和零到一幅度。');
    }
    if (this.released) {
      return;
    }
    this.released = true;
    this.releaseSource = source;
    this.releasedX = x;
    this.releasedY = y;
    this.releasedAmplitude = amplitude;
  }
}
