import { type StaticSurfaceBufferGeometry } from '../../../../core/geometry/buffer-geometry';
import { WeaponGrip } from '../../../../core/equipment/equipment';
import { type BattlefieldEquipmentDefinitionById } from './battlefield-equipment-contracts';
import { EquipmentId } from './equipment-id';

/** 一件装备在世界掉落状态下的稳定展示尺度。 */
export interface DroppedEquipmentProfile {
  readonly scale: number;
  readonly boundsRadius: number;
}

/** 一种装备相对角色手部权威挂点的中立程序模型变换。 */
export interface HeldEquipmentProfile {
  readonly grip: WeaponGrip;
  readonly heldScale: number;
  readonly mainGripLocalPosition: Readonly<{ x: number; y: number; z: number }>;
  readonly hammerHeadLocalPosition: Readonly<{ x: number; y: number; z: number }>;
  readonly hammerHeadRadius: number;
}

/** 一件战场装备同时拥有玩法定义、固定几何和两种展示配置。 */
export interface BattlefieldEquipmentPrototype<TId extends EquipmentId> {
  readonly id: TId;
  readonly definition: Readonly<BattlefieldEquipmentDefinitionById[TId]>;
  readonly geometry: StaticSurfaceBufferGeometry;
  readonly dropped: Readonly<DroppedEquipmentProfile>;
  readonly held: Readonly<HeldEquipmentProfile>;
}

/** 战场装备标识到完整原型类别的编译期映射。 */
export type BattlefieldEquipmentPrototypeById = {
  readonly [TId in EquipmentId]: BattlefieldEquipmentPrototype<TId>;
};
