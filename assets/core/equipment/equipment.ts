/** 可由装备库稳定引用的装备标识。 */
export enum EquipmentId {
  DesertEagle = 'desert-eagle',
  PumpShotgun = 'pump-shotgun',
}

/** 装备进入背包、掉落和交互系统时使用的领域分类。 */
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

/** 武器定义内部的强类型武器门类。 */
export enum WeaponClass {
  Handgun = 'handgun',
  Shotgun = 'shotgun',
}

/** 投射物渲染器能够选择的领域化外观。 */
export enum WeaponProjectileVisual {
  Bullet = 'bullet',
  BuckshotPellet = 'buckshot-pellet',
}

/** 武器弹药消耗规则的稳定标识。 */
export enum WeaponAmmunitionMode {
  Infinite = 'infinite',
  TubeMagazine = 'tube-magazine',
}

/** 默认不消耗库存的无限弹药规则。 */
export interface InfiniteWeaponAmmunitionDefinition {
  readonly mode: WeaponAmmunitionMode.Infinite;
}

/** 管式弹仓逐发装填时使用的容量与单发装填节奏。 */
export interface TubeMagazineWeaponAmmunitionDefinition {
  readonly mode: WeaponAmmunitionMode.TubeMagazine;
  readonly capacity: number;
  readonly shellReloadSeconds: number;
}

/** 武器定义能够声明的完整弹药规则联合。 */
export type WeaponAmmunitionDefinition =
  | InfiniteWeaponAmmunitionDefinition
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

/** 实体子弹的速度、射程与命中半径。 */
export interface WeaponProjectileDefinition {
  readonly speed: number;
  readonly maximumRange: number;
  readonly impactRadius: number;
  readonly visual: WeaponProjectileVisual;
}

/** 所有装备定义共享的只读身份与展示契约。 */
export interface EquipmentDefinitionBase<TCategory extends EquipmentCategory> {
  readonly id: EquipmentId;
  readonly category: TCategory;
  readonly displayName: string;
  readonly description: string;
  readonly rarity: EquipmentRarity;
}

/** 武器库对战斗和 UI 提供的稳定武器参数。 */
export interface WeaponEquipmentDefinition
extends EquipmentDefinitionBase<EquipmentCategory.Weapon> {
  readonly weaponClass: WeaponClass;
  readonly damage: number;
  readonly fireIntervalSeconds: number;
  readonly attackAnimationSeconds: number;
  readonly ammunition: Readonly<WeaponAmmunitionDefinition>;
  readonly shotPattern: Readonly<WeaponShotPattern>;
  readonly projectile: Readonly<WeaponProjectileDefinition>;
}

/** 当前装备库允许返回的完整判别联合。 */
export type EquipmentDefinition = WeaponEquipmentDefinition;

/**
 * 装备标识到只读定义的查询门面。
 *
 * 宝箱和掉落系统只依赖此接口，不依赖具体目录或渲染工厂；以后扩展装备库时可独立
 * 替换实现而不改动开箱和抛射流程。
 */
export interface EquipmentLibrary {
  get(id: EquipmentId): Readonly<EquipmentDefinition>;
}
