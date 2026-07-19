import { type Material, Node } from 'cc';
import { EquipmentId } from '../../../../core/equipment/equipment';
import { type StaticSurfaceBufferGeometry } from '../../../../core/geometry/buffer-geometry';
import { StaticSurfaceMesh } from '../../../../core/rendering/static-surface-mesh';
import { DESERT_EAGLE_GEOMETRY } from '../geometry/desert-eagle-geometry';

const EQUIPMENT_MODEL_SCALE = 0.34;
const EQUIPMENT_SURFACE_OPTIONS = Object.freeze({
  castShadows: true,
  receiveShadows: true,
  uploadLightingAttributes: true,
});

/** 装备标识到程序化固定拓扑的完整工厂映射。 */
const EQUIPMENT_GEOMETRY = Object.freeze({
  [EquipmentId.DesertEagle]: DESERT_EAGLE_GEOMETRY,
} satisfies Readonly<Record<EquipmentId, StaticSurfaceBufferGeometry>>);

/** 单件掉落装备的 Cocos 节点与 Mesh 适配器。 */
export class DroppedEquipmentRenderer {
  private readonly root: Node;
  private readonly mesh = new StaticSurfaceMesh();
  private disposed = false;

  constructor(parent: Node, equipmentId: EquipmentId, material: Material) {
    const root = new Node('DroppedEquipment');
    parent.addChild(root);
    root.setScale(EQUIPMENT_MODEL_SCALE, EQUIPMENT_MODEL_SCALE, EQUIPMENT_MODEL_SCALE);
    root.active = false;
    this.root = root;
    try {
      this.mesh.initialize(
        root,
        'DroppedEquipmentSurface',
        EQUIPMENT_GEOMETRY[equipmentId],
        material,
        EQUIPMENT_SURFACE_OPTIONS,
      );
    } catch (error: unknown) {
      this.dispose();
      throw error;
    }
  }

  /** 切换延迟抛射阶段的可见性。 */
  public setVisible(visible: boolean): void {
    if (!this.disposed && this.root.active !== visible) {
      this.root.active = visible;
    }
  }

  /** 原地同步掉落物的世界位置与欧拉旋转。 */
  public setPose(
    x: number,
    y: number,
    z: number,
    rotationX: number,
    rotationY: number,
    rotationZ: number,
  ): void {
    if (this.disposed) {
      return;
    }
    this.root.setPosition(x, y, z);
    this.root.setRotationFromEuler(rotationX, rotationY, rotationZ);
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.mesh.dispose();
    if (this.root.isValid) {
      this.root.destroy();
    }
  }
}
