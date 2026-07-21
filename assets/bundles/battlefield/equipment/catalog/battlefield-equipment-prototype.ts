import { type StaticSurfaceBufferGeometry } from '../../../../core/geometry/buffer-geometry';
import { WeaponGrip } from '../../../../core/equipment/equipment';
import {
  type BattlefieldEquipmentDefinitionById,
} from './battlefield-equipment-contracts';
import {
  type AmmunitionEquipmentId,
  EquipmentId,
  type WeaponEquipmentId,
} from './equipment-id';

/** 一件装备在世界掉落状态下的稳定展示尺度。 */
export interface DroppedEquipmentProfile {
  readonly scale: number;
}

/** 一种武器相对通用 WeaponAimRoot 的程序模型变换。 */
export interface HeldWeaponProfile {
  readonly grip: WeaponGrip;
  readonly heldScale: number;
  readonly originRightOffset: number;
  readonly originHeightOffset: number;
  readonly originForwardOffset: number;
  readonly rotationXDegrees: number;
  readonly rotationYDegrees: number;
  readonly rotationZDegrees: number;
}

/** 武器原型同时拥有玩法定义、固定几何和两种展示配置。 */
export interface BattlefieldWeaponPrototype<TId extends WeaponEquipmentId> {
  readonly id: TId;
  readonly definition: Readonly<BattlefieldEquipmentDefinitionById[TId]>;
  readonly geometry: StaticSurfaceBufferGeometry;
  readonly dropped: Readonly<DroppedEquipmentProfile>;
  readonly held: Readonly<HeldWeaponProfile>;
}

/** 弹药原型只拥有玩法定义、固定几何和掉落展示配置。 */
export interface BattlefieldAmmunitionPrototype<TId extends AmmunitionEquipmentId> {
  readonly id: TId;
  readonly definition: Readonly<BattlefieldEquipmentDefinitionById[TId]>;
  readonly geometry: StaticSurfaceBufferGeometry;
  readonly dropped: Readonly<DroppedEquipmentProfile>;
}

/** 战场装备标识到完整原型类别的编译期映射。 */
export type BattlefieldEquipmentPrototypeById = {
  readonly [TId in WeaponEquipmentId]: BattlefieldWeaponPrototype<TId>;
} & {
  readonly [TId in AmmunitionEquipmentId]: BattlefieldAmmunitionPrototype<TId>;
};

/** 战场完整原型清单能够容纳的定义联合。 */
export type BattlefieldEquipmentPrototype = BattlefieldEquipmentPrototypeById[EquipmentId];
