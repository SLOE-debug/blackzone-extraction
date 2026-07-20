import { type Material, Mat4, Node, Quat, Vec3 } from 'cc';
import { type EquipmentId } from '../../../../core/equipment/equipment';
import {
  createSurfaceGeometry,
  GeometryIndexFormat,
  type MutableGeometryBounds,
  type StaticSurfaceBufferGeometry,
  type SurfaceBufferGeometry,
  writePositionBounds,
} from '../../../../core/geometry/buffer-geometry';
import { MeshDirty } from '../../../../core/mesh/mesh-dirty';
import { DynamicMeshBatch } from '../../../../core/rendering/dynamic-mesh-batch';
import { getBattlefieldEquipmentGeometry } from './battlefield-equipment-geometry';

const EQUIPMENT_MODEL_SCALE = 0.34;
const EQUIPMENT_SURFACE_OPTIONS = Object.freeze({
  castShadows: true,
  receiveShadows: true,
});

/** 掉落物大批次读取的稳定姿态契约。 */
export interface DroppedEquipmentRenderItem {
  readonly equipmentId: EquipmentId;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly rotationX: number;
  readonly rotationY: number;
  readonly rotationZ: number;
  readonly visible: boolean;
}

/** 将一次或多次爆散产生的全部掉落装备压入一个动态 MeshRenderer。 */
export class DroppedEquipmentRenderer {
  private readonly geometry: SurfaceBufferGeometry;
  private readonly sources: readonly StaticSurfaceBufferGeometry[];
  private readonly vertexOffsets: readonly number[];
  private readonly batch = new DynamicMeshBatch();
  private readonly rotation = new Quat();
  private readonly matrix = new Mat4();
  private readonly position = new Vec3();
  private readonly scale = new Vec3(
    EQUIPMENT_MODEL_SCALE,
    EQUIPMENT_MODEL_SCALE,
    EQUIPMENT_MODEL_SCALE,
  );
  private readonly bounds: MutableGeometryBounds = {
    minX: 0,
    minY: 0,
    minZ: 0,
    maxX: 0,
    maxY: 0,
    maxZ: 0,
  };
  private disposed = false;

  constructor(
    parent: Node,
    private readonly items: readonly DroppedEquipmentRenderItem[],
    material: Material,
  ) {
    if (items.length === 0) {
      throw new Error('掉落装备批渲染器至少需要一个实例。');
    }
    this.sources = Object.freeze(items.map(
      (item) => getBattlefieldEquipmentGeometry(item.equipmentId),
    ));
    this.vertexOffsets = createVertexOffsets(this.sources);
    const vertexCount = this.sources.reduce((total, source) => total + source.vertexCount, 0);
    const indexCount = this.sources.reduce((total, source) => total + source.indexCount, 0);
    this.geometry = createSurfaceGeometry(
      vertexCount,
      indexCount,
      GeometryIndexFormat.Uint32,
    );
    this.geometry.commitCounts(vertexCount, indexCount);
    writeFixedStreams(this.sources, this.vertexOffsets, this.geometry);
    const visible = this.writePoses();
    writePositionBounds(this.geometry.getPositionView(), this.bounds);
    try {
      this.batch.initialize(
        parent,
        'DroppedEquipmentBatch',
        this.geometry,
        material,
        this.bounds,
        EQUIPMENT_SURFACE_OPTIONS,
      );
      this.batch.setVisible(visible);
    } catch (error: unknown) {
      this.batch.dispose();
      throw error;
    }
  }

  /** 一次性重写全部实例姿态并只上传一组 Position、Normal 缓冲。 */
  public update(): void {
    if (this.disposed) {
      return;
    }
    const visible = this.writePoses();
    writePositionBounds(this.geometry.getPositionView(), this.bounds);
    this.batch.uploadVertexAttributes(MeshDirty.Pose);
    this.batch.updateBounds(this.bounds);
    this.batch.setVisible(visible);
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.batch.dispose();
  }

  private writePoses(): boolean {
    let anyVisible = false;
    for (let index = 0; index < this.items.length; index++) {
      const item = this.items[index];
      const source = this.sources[index];
      const vertexOffset = this.vertexOffsets[index];
      if (item === undefined || source === undefined || vertexOffset === undefined) {
        throw new Error('掉落装备批次实例、几何与顶点区段未能一一对应。');
      }
      anyVisible ||= item.visible;
      this.position.set(item.x, item.y, item.z);
      Quat.fromEuler(this.rotation, item.rotationX, item.rotationY, item.rotationZ);
      Mat4.fromRTS(this.matrix, this.rotation, this.position, this.scale);
      writeTransformedGeometry(
        source,
        this.geometry,
        vertexOffset,
        item.visible,
        this.matrix,
      );
    }
    return anyVisible;
  }
}

function createVertexOffsets(
  sources: readonly StaticSurfaceBufferGeometry[],
): readonly number[] {
  const offsets: number[] = [];
  let vertexOffset = 0;
  for (const source of sources) {
    offsets.push(vertexOffset);
    vertexOffset += source.vertexCount;
  }
  return Object.freeze(offsets);
}

function writeFixedStreams(
  sources: readonly StaticSurfaceBufferGeometry[],
  vertexOffsets: readonly number[],
  target: SurfaceBufferGeometry,
): void {
  let targetIndexOffset = 0;
  for (let sourceIndex = 0; sourceIndex < sources.length; sourceIndex++) {
    const source = sources[sourceIndex];
    const vertexOffset = vertexOffsets[sourceIndex];
    if (source === undefined || vertexOffset === undefined) {
      throw new Error('掉落装备固定流区段不存在。');
    }
    target.colors.set(source.getColorView(), vertexOffset * 4);
    const indices = source.getIndexView();
    for (let index = 0; index < indices.length; index++) {
      target.index[targetIndexOffset + index] = (indices[index] ?? 0) + vertexOffset;
    }
    targetIndexOffset += indices.length;
  }
}

function writeTransformedGeometry(
  source: StaticSurfaceBufferGeometry,
  target: SurfaceBufferGeometry,
  targetVertexOffset: number,
  visible: boolean,
  matrix: Readonly<Mat4>,
): void {
  const inverseScale = 1 / EQUIPMENT_MODEL_SCALE;
  for (let vertex = 0; vertex < source.vertexCount; vertex++) {
    const sourceOffset = vertex * 3;
    const targetOffset = (targetVertexOffset + vertex) * 3;
    const x = source.positions[sourceOffset] ?? 0;
    const y = source.positions[sourceOffset + 1] ?? 0;
    const z = source.positions[sourceOffset + 2] ?? 0;
    target.positions[targetOffset] = visible
      ? matrix.m00 * x + matrix.m04 * y + matrix.m08 * z + matrix.m12
      : matrix.m12;
    target.positions[targetOffset + 1] = visible
      ? matrix.m01 * x + matrix.m05 * y + matrix.m09 * z + matrix.m13
      : matrix.m13;
    target.positions[targetOffset + 2] = visible
      ? matrix.m02 * x + matrix.m06 * y + matrix.m10 * z + matrix.m14
      : matrix.m14;

    const normalX = source.normals[sourceOffset] ?? 0;
    const normalY = source.normals[sourceOffset + 1] ?? 0;
    const normalZ = source.normals[sourceOffset + 2] ?? 0;
    target.normals[targetOffset] = (
      matrix.m00 * normalX + matrix.m04 * normalY + matrix.m08 * normalZ
    ) * inverseScale;
    target.normals[targetOffset + 1] = (
      matrix.m01 * normalX + matrix.m05 * normalY + matrix.m09 * normalZ
    ) * inverseScale;
    target.normals[targetOffset + 2] = (
      matrix.m02 * normalX + matrix.m06 * normalY + matrix.m10 * normalZ
    ) * inverseScale;
  }
}
