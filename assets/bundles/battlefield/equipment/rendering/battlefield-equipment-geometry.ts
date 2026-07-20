import { EquipmentId } from '../../../../core/equipment/equipment';
import { type StaticSurfaceBufferGeometry } from '../../../../core/geometry/buffer-geometry';
import { DESERT_EAGLE_GEOMETRY } from '../geometry/desert-eagle-geometry';

/** 装备标识到程序化固定拓扑的完整渲染映射。 */
const BATTLEFIELD_EQUIPMENT_GEOMETRY = Object.freeze({
  [EquipmentId.DesertEagle]: DESERT_EAGLE_GEOMETRY,
} satisfies Readonly<Record<EquipmentId, StaticSurfaceBufferGeometry>>);

/** 返回指定装备已经编译完成的程序化固定拓扑。 */
export function getBattlefieldEquipmentGeometry(
  equipmentId: EquipmentId,
): StaticSurfaceBufferGeometry {
  return BATTLEFIELD_EQUIPMENT_GEOMETRY[equipmentId];
}
