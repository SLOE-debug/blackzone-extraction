/** 装备进入背包、掉落和交互系统时使用的领域分类。 */
export enum EquipmentCategory {
  Weapon = 'weapon',
  Ammunition = 'ammunition',
}

/** 决定装备名称展示颜色与掉落价值层级的品质。 */
export enum EquipmentRarity {
  Common = 'common',
  Rare = 'rare',
  Epic = 'epic',
  Legendary = 'legendary',
}

/** 武器定义内部的强类型武器门类。 */
export enum WeaponClass {
  Handgun = 'handgun',
  Shotgun = 'shotgun',
  SubmachineGun = 'submachine-gun',
  AssaultRifle = 'assault-rifle',
}

/** 武器向任意角色动画层声明的中立握持方式。 */
export enum WeaponGrip {
  Handgun = 'handgun',
  LongGun = 'long-gun',
}

/** 武器运行时向任意角色动画层声明的中立动作。 */
export enum WeaponAction {
  Ready = 'ready',
  Fire = 'fire',
  Reload = 'reload',
}

/** 武器弹仓与世界弹药拾取物之间共享的弹药口径标识。 */
export enum AmmunitionType {
  FiftyActionExpress = '50-action-express',
  TwelveGauge = '12-gauge',
  FortyFiveAcp = '45-acp',
  FiveFiveSixNato = '5.56x45-nato',
  SevenSixTwoByThirtyNine = '7.62x39',
}

/** 投射物渲染器能够选择的领域化外观。 */
export enum WeaponProjectileVisual {
  Bullet = 'bullet',
  BuckshotPellet = 'buckshot-pellet',
}

/** 武器弹药消耗规则的稳定标识。 */
export enum WeaponAmmunitionMode {
  Magazine = 'magazine',
  TubeMagazine = 'tube-magazine',
}

/** 可拆卸弹匣一次装填时使用的容量与换弹节奏。 */
export interface MagazineWeaponAmmunitionDefinition {
  readonly mode: WeaponAmmunitionMode.Magazine;
  readonly ammunitionType: AmmunitionType;
  readonly capacity: number;
  readonly reloadSeconds: number;
  /** 玩家首次获得该枪型时写入共享口径库存的备用弹量。 */
  readonly initialReserveRounds: number;
}

/** 管式弹仓逐发装填时使用的容量与单发装填节奏。 */
export interface TubeMagazineWeaponAmmunitionDefinition {
  readonly mode: WeaponAmmunitionMode.TubeMagazine;
  readonly ammunitionType: AmmunitionType;
  readonly capacity: number;
  readonly shellReloadSeconds: number;
  /** 玩家首次获得该枪型时写入共享口径库存的备用弹量。 */
  readonly initialReserveRounds: number;
}

/** 武器定义能够声明的完整弹药规则联合。 */
export type WeaponAmmunitionDefinition =
  | MagazineWeaponAmmunitionDefinition
  | TubeMagazineWeaponAmmunitionDefinition;

/** 决定一次扳机动作产生单弹体还是固定散布弹丸。 */
export enum WeaponShotPatternType {
  Single = 'single',
  PelletCone = 'pellet-cone',
}

/** 单弹体武器不会对瞄准方向施加散布。 */
export interface SingleWeaponShotPattern {
  readonly type: WeaponShotPatternType.Single;
}

/** 霰弹武器使用确定性锥形分布，避免每次运行产生不同弹道。 */
export interface PelletConeWeaponShotPattern {
  readonly type: WeaponShotPatternType.PelletCone;
  readonly projectileCount: number;
  readonly horizontalSpreadRadians: number;
  readonly verticalSpreadRadians: number;
}

/** 武器一次攻击使用的强类型弹体分布。 */
export type WeaponShotPattern = SingleWeaponShotPattern | PelletConeWeaponShotPattern;

/** Hitscan 射程、贯穿参数与无碰撞曳光表现。 */
export interface WeaponProjectileDefinition {
  readonly speed: number;
  readonly maximumRange: number;
  readonly impactRadius: number;
  readonly maximumHitCount: number;
  readonly damageRetention: number;
  readonly visual: WeaponProjectileVisual;
}

/** 所有装备定义共享的只读身份与展示契约。 */
export interface EquipmentDefinitionBase<
  TId extends string,
  TCategory extends EquipmentCategory,
> {
  readonly id: TId;
  readonly category: TCategory;
  readonly displayName: string;
  readonly description: string;
  readonly rarity: EquipmentRarity;
}

/** 武器库对战斗和 UI 提供的稳定武器参数。 */
export interface WeaponEquipmentDefinition<TId extends string = string>
extends EquipmentDefinitionBase<TId, EquipmentCategory.Weapon> {
  readonly weaponClass: WeaponClass;
  readonly damage: number;
  readonly fireIntervalSeconds: number;
  readonly attackAnimationSeconds: number;
  readonly ammunition: Readonly<WeaponAmmunitionDefinition>;
  readonly shotPattern: Readonly<WeaponShotPattern>;
  readonly projectile: Readonly<WeaponProjectileDefinition>;
}

/** 世界弹药拾取物向对应备用库存增加的弹药类型与数量。 */
export interface AmmunitionEquipmentDefinition<TId extends string = string>
extends EquipmentDefinitionBase<TId, EquipmentCategory.Ammunition> {
  readonly ammunitionType: AmmunitionType;
  readonly rounds: number;
}

/** 当前装备库允许返回的完整判别联合。 */
export type EquipmentDefinition<TId extends string = string> =
  | WeaponEquipmentDefinition<TId>
  | AmmunitionEquipmentDefinition<TId>;

/**
 * 装备标识到只读定义的查询门面。
 *
 * 宝箱和掉落系统只依赖此接口，不依赖具体目录或渲染工厂；以后扩展装备库时可独立
 * 替换实现而不改动开箱和抛射流程。
 */
export interface EquipmentLibrary<
  TId extends string,
  TDefinitions extends { readonly [TKey in TId]: EquipmentDefinition<TKey> },
> {
  get<TKey extends TId>(id: TKey): Readonly<TDefinitions[TKey]>;
}
