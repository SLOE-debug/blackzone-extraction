/** 装备进入物品栏、掉落和交互系统时使用的领域分类。 */
export enum EquipmentCategory {
  Weapon = 'weapon',
}

/** 决定装备名称展示颜色与掉落价值层级的品质。 */
export enum EquipmentRarity {
  Common = 'common',
  Rare = 'rare',
  Epic = 'epic',
  Legendary = 'legendary',
}

/** 武器定义内部的强类型行为门类。 */
export enum WeaponKind {
  Sledgehammer = 'sledgehammer',
  ReturningBow = 'returning-bow',
}

/** 武器向任意角色动画层声明的中立握持方式。 */
export enum WeaponGrip {
  TwoHandHeavy = 'two-hand-heavy',
  TwoHandRanged = 'two-hand-ranged',
}

/** 武器原型向输入层声明的稳定技能命令。 */
export enum WeaponSkillCommand {
  Spin = 'spin',
  GroundSlam = 'ground-slam',
  RecallAll = 'recall-all',
  HuntingTether = 'hunting-tether',
}

/** 武器行为运行时向任意角色动画层声明的中立动作。 */
export enum WeaponAction {
  Idle = 'idle',
  Primary = 'primary',
  WindupLeft = 'windup-left',
  SwingLeft = 'swing-left',
  ChainPrepareLeft = 'chain-prepare-left',
  WindupRight = 'windup-right',
  SwingRight = 'swing-right',
  ChainPrepareRight = 'chain-prepare-right',
  Uppercut = 'uppercut',
  GroundSlam = 'ground-slam',
  Spin = 'spin',
  Recover = 'recover',
}

/** 所有装备定义共享的只读身份、堆叠与展示契约。 */
export interface EquipmentDefinitionBase<
  TId extends string,
  TCategory extends EquipmentCategory,
> {
  readonly id: TId;
  readonly category: TCategory;
  readonly displayName: string;
  readonly description: string;
  readonly rarity: EquipmentRarity;
  readonly maximumStack: number;
}

/** 近战武器库向战斗行为与 UI 提供的稳定参数。 */
export interface MeleeWeaponDefinition<TId extends string = string>
extends EquipmentDefinitionBase<TId, EquipmentCategory.Weapon> {
  readonly kind: WeaponKind.Sledgehammer;
  readonly baseDamage: number;
  readonly reach: number;
  readonly hitArcRadians: number;
  readonly attackIntervalSeconds: number;
  readonly knockbackImpulse: number;
  readonly comboWindowSeconds: number;
  readonly specialRequiredHits: number;
}

/** 固定实体投射武器向射击、召回和资源表现提供的稳定参数。 */
export interface ProjectileWeaponDefinition<TId extends string = string>
extends EquipmentDefinitionBase<TId, EquipmentCategory.Weapon> {
  readonly kind: WeaponKind.ReturningBow;
  readonly baseDamage: number;
  readonly attackIntervalSeconds: number;
  readonly projectileSpeed: number;
  readonly projectileRadius: number;
  readonly maximumRange: number;
  readonly chargeDurationSeconds: number;
  readonly maximumChargeDamageScale: number;
  readonly maximumChargeSpeedScale: number;
  readonly maximumChargePierceCount: number;
  readonly projectileCapacity: number;
  readonly automaticRecallMinimumSpeed: number;
  readonly automaticRecallMaximumSpeed: number;
  readonly skillRecallMinimumSpeed: number;
  readonly skillRecallMaximumSpeed: number;
  readonly recallAccelerationDistance: number;
  readonly automaticRecallDamageScale: number;
  readonly skillRecallDamageScale: number;
  readonly extractionDamageScale: number;
  readonly tetherDurationSeconds: number;
  readonly tetherDamageScale: number;
  readonly tetherHitCooldownSeconds: number;
  readonly tetherSlowScale: number;
  readonly tetherSlowDurationSeconds: number;
}

/** 当前装备库允许返回的完整判别联合。 */
export type EquipmentDefinition<TId extends string = string> =
  | MeleeWeaponDefinition<TId>
  | ProjectileWeaponDefinition<TId>;

/**
 * 装备标识到只读定义的查询门面。
 *
 * 宝箱、物品栏和掉落系统只依赖此接口，不依赖具体目录或渲染工厂。
 */
export interface EquipmentLibrary<
  TId extends string,
  TDefinitions extends { readonly [TKey in TId]: EquipmentDefinition<TKey> },
> {
  get<TKey extends TId>(id: TKey): Readonly<TDefinitions[TKey]>;
}
