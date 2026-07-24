import { type BattlefieldCombatEventType } from '../events/battlefield-combat-event-type';

/** 战场运行时允许装备和选择的行为模块标识。 */
export enum BattlefieldCombatModuleId {
  Grab,
  Throw,
  Reserved,
}

export enum BattlefieldCombatModuleCategory {
  ActiveAction,
  PassiveCondition,
  ActionModifier,
  Reaction,
}

export enum BattlefieldCombatModuleTrigger {
  HoldAndRelease,
  Event,
}

export enum BattlefieldCombatModulePreview {
  None,
  DirectionalTarget,
  ThrowLanding,
}

export enum BattlefieldCombatModuleInputMode {
  Direction,
  DirectionAndAmplitude,
  None,
}

export enum BattlefieldCombatModuleIcon {
  Grab,
  Throw,
  Reserved,
}

export enum BattlefieldCombatModulePrerequisite {
  None,
  NoCarriedTarget,
  HasThrowableTarget,
}

export enum BattlefieldCombatModuleBehavior {
  None,
  GrabEntity,
  ThrowEntity,
}

/** 模块注册表保存的统一只读定义。 */
export interface BattlefieldCombatModuleDefinition {
  readonly id: BattlefieldCombatModuleId;
  readonly displayName: string;
  readonly icon: BattlefieldCombatModuleIcon;
  readonly category: BattlefieldCombatModuleCategory;
  readonly trigger: BattlefieldCombatModuleTrigger;
  readonly prerequisite: BattlefieldCombatModulePrerequisite;
  readonly behavior: BattlefieldCombatModuleBehavior;
  readonly preview: BattlefieldCombatModulePreview;
  readonly inputMode: BattlefieldCombatModuleInputMode;
  readonly cooldownSeconds: number;
  readonly listenedEvents: readonly BattlefieldCombatEventType[];
}

/** 模块不可执行时交给 UI 的类型化原因。 */
export enum BattlefieldCombatModuleUnavailableReason {
  None,
  AlreadyCarrying,
  NeedsCarriedTarget,
  ReservedSlot,
}
