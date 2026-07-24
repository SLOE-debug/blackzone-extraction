import {
  BattlefieldCombatModuleCategory,
  type BattlefieldCombatModuleDefinition,
  BattlefieldCombatModuleIcon,
  BattlefieldCombatModuleId,
  BattlefieldCombatModuleInputMode,
  BattlefieldCombatModulePreview,
  BattlefieldCombatModulePrerequisite,
  BattlefieldCombatModuleBehavior,
  BattlefieldCombatModuleTrigger,
} from '../model/battlefield-combat-module';

const EMPTY_EVENT_LIST = Object.freeze([]);

const MODULES = Object.freeze([
  Object.freeze({
    id: BattlefieldCombatModuleId.Grab,
    displayName: '抓取',
    icon: BattlefieldCombatModuleIcon.Grab,
    category: BattlefieldCombatModuleCategory.ActiveAction,
    trigger: BattlefieldCombatModuleTrigger.HoldAndRelease,
    prerequisite: BattlefieldCombatModulePrerequisite.NoCarriedTarget,
    behavior: BattlefieldCombatModuleBehavior.GrabEntity,
    preview: BattlefieldCombatModulePreview.DirectionalTarget,
    inputMode: BattlefieldCombatModuleInputMode.Direction,
    cooldownSeconds: 0,
    listenedEvents: EMPTY_EVENT_LIST,
  }),
  Object.freeze({
    id: BattlefieldCombatModuleId.Throw,
    displayName: '投掷',
    icon: BattlefieldCombatModuleIcon.Throw,
    category: BattlefieldCombatModuleCategory.ActiveAction,
    trigger: BattlefieldCombatModuleTrigger.HoldAndRelease,
    prerequisite: BattlefieldCombatModulePrerequisite.HasThrowableTarget,
    behavior: BattlefieldCombatModuleBehavior.ThrowEntity,
    preview: BattlefieldCombatModulePreview.ThrowLanding,
    inputMode: BattlefieldCombatModuleInputMode.DirectionAndAmplitude,
    cooldownSeconds: 0,
    listenedEvents: EMPTY_EVENT_LIST,
  }),
  Object.freeze({
    id: BattlefieldCombatModuleId.Reserved,
    displayName: '预留',
    icon: BattlefieldCombatModuleIcon.Reserved,
    category: BattlefieldCombatModuleCategory.ActiveAction,
    trigger: BattlefieldCombatModuleTrigger.HoldAndRelease,
    prerequisite: BattlefieldCombatModulePrerequisite.None,
    behavior: BattlefieldCombatModuleBehavior.None,
    preview: BattlefieldCombatModulePreview.None,
    inputMode: BattlefieldCombatModuleInputMode.None,
    cooldownSeconds: 0,
    listenedEvents: EMPTY_EVENT_LIST,
  }),
] satisfies readonly BattlefieldCombatModuleDefinition[]);

/** 初始化后封存的类型化模块注册表。 */
export class BattlefieldCombatModuleRegistry {
  private readonly definitions: ReadonlyMap<
    BattlefieldCombatModuleId,
    Readonly<BattlefieldCombatModuleDefinition>
  >;

  constructor() {
    this.definitions = new Map(MODULES.map((definition) => [definition.id, definition]));
    if (this.definitions.size !== MODULES.length) {
      throw new Error('战场行为模块标识不能重复注册。');
    }
  }

  public get(id: BattlefieldCombatModuleId): Readonly<BattlefieldCombatModuleDefinition> {
    const definition = this.definitions.get(id);
    if (definition === undefined) {
      throw new Error(`战场行为模块尚未注册：${id}`);
    }
    return definition;
  }

  public get ordered(): readonly Readonly<BattlefieldCombatModuleDefinition>[] {
    return MODULES;
  }
}
