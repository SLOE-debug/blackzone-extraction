import { type Material, Node } from 'cc';
import { GeometryIndexFormat } from '../../../core/geometry/buffer-geometry';
import { FixedTopologyBatchRenderer } from '../../../core/rendering/fixed-topology-batch-renderer';
import { vanguardOpaqueGeometry } from '../geometry/vanguard-opaque-geometry';
import { vanguardSensorGeometry } from '../geometry/vanguard-sensor-geometry';
import { type VanguardState } from '../model/vanguard-state';
import { createVanguardBounds } from './vanguard-bounds';
import { VanguardMaterials } from './vanguard-materials';
import {
  vanguardOpaqueVertexShading,
  vanguardSensorVertexShading,
} from './vanguard-vertex-shading';

/** 主角受光渲染层标识。 */
export enum VanguardOpaqueRenderLayer {
  Armor = 'armor',
}

/** 主角发光渲染层标识。 */
export enum VanguardSensorRenderLayer {
  Sensor = 'sensor',
}

/** 组合主角两层固定拓扑动态网格与独占材质。 */
export class VanguardRenderer {
  private readonly materials: VanguardMaterials;
  private opaqueBatches: FixedTopologyBatchRenderer<
    VanguardState,
    VanguardOpaqueRenderLayer
  > | null = null;
  private sensorBatches: FixedTopologyBatchRenderer<
    VanguardState,
    VanguardSensorRenderLayer
  > | null = null;
  private disposed = false;

  constructor(parent: Node, state: VanguardState, surfaceMaterialTemplate: Material) {
    this.materials = new VanguardMaterials(surfaceMaterialTemplate);
    const bounds = createVanguardBounds(state);
    try {
      this.opaqueBatches = new FixedTopologyBatchRenderer({
        parent,
        source: state,
        entityCount: state.count,
        requestedBatchSize: state.count,
        indexFormat: GeometryIndexFormat.Uint16,
        bounds,
        surfaceOptions: Object.freeze({
          uploadLightingAttributes: true,
          castShadows: true,
          receiveShadows: true,
        }),
        shading: vanguardOpaqueVertexShading,
        layers: Object.freeze([
          Object.freeze({
            id: VanguardOpaqueRenderLayer.Armor,
            nodeName: 'VanguardArmor',
            material: this.materials.armor,
            geometry: vanguardOpaqueGeometry,
          }),
        ]),
      });
      this.sensorBatches = new FixedTopologyBatchRenderer({
        parent,
        source: state,
        entityCount: state.count,
        requestedBatchSize: state.count,
        indexFormat: GeometryIndexFormat.Uint16,
        bounds,
        surfaceOptions: Object.freeze({
          uploadLightingAttributes: false,
          castShadows: false,
          receiveShadows: false,
        }),
        shading: vanguardSensorVertexShading,
        layers: Object.freeze([
          Object.freeze({
            id: VanguardSensorRenderLayer.Sensor,
            nodeName: 'VanguardSensor',
            material: this.materials.sensor,
            geometry: vanguardSensorGeometry,
          }),
        ]),
      });
    } catch (error: unknown) {
      this.sensorBatches?.dispose();
      this.opaqueBatches?.dispose();
      this.materials.dispose();
      throw error;
    }
  }

  /** 重写并上传主角装甲与传感器动态顶点流。 */
  public update(): void {
    if (this.disposed || this.opaqueBatches === null || this.sensorBatches === null) {
      throw new Error('主角渲染器尚未初始化或已经释放。');
    }
    this.opaqueBatches.update();
    this.sensorBatches.update();
  }

  /** 先释放动态网格，再释放其引用的材质。 */
  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.sensorBatches?.dispose();
    this.opaqueBatches?.dispose();
    this.sensorBatches = null;
    this.opaqueBatches = null;
    this.materials.dispose();
    this.disposed = true;
  }
}
