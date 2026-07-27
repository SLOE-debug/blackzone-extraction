/** 主角移动系统支持的权威朝向控制策略。 */
export enum VanguardFacingPolicy {
  /** 没有外部动作占用朝向，身体跟随移动或攻击输入。 */
  Free,
  /** 以有限角速度追随动作目标方向。 */
  SoftTarget,
  /** 接触阶段只允许以很低角速度修正动作方向。 */
  ContactLocked,
  /** 由动作时间轴直接驱动身体朝向。 */
  SpinDriven,
}
