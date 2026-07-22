import { type VertexStreams } from '../../../../../core/mesh/vertex-streams';
import { type CurveCrawlerState } from '../model/curve-crawler-state';
import { CurveCrawlerGpuBindPoseBuilder } from './curve-crawler-gpu-bind-pose';
import {
  type CurveCrawlerGpuDeformationStreams,
  writeCurveCrawlerGpuDeformationLayout,
} from './curve-crawler-gpu-deformation-layout';
import { type CurveCrawlerMeshPlan } from './curve-crawler-mesh-plan';

/** 静态 GPU 局部网格读取的稳定实体槽位来源。 */
export interface CurveCrawlerGpuGeometrySource {
  readonly state: CurveCrawlerState;
  readonly gpuSlotOffset: number;
}

/**
 * 保存 Curve Crawler GPU 形变所需的不可变局部顶点流与可变索引前缀。
 *
 * Position/Normal 只在批次结构变化时由 Bind Pose Builder 生成；逐帧姿态不再改写它们。
 */
export class CurveCrawlerGpuGeometry {
  public readonly positions: Float32Array;
  public readonly normals: Float32Array;
  public readonly colors: Float32Array;
  public readonly slotAndSemantic: Float32Array;
  public readonly deformation: Float32Array;
  public readonly pivot: Float32Array;
  public readonly index: Uint32Array;
  public readonly streams: VertexStreams;
  public readonly deformationStreams: CurveCrawlerGpuDeformationStreams;
  public readonly vertexCount: number;
  public readonly indexCapacity: number;

  constructor(
    public readonly entityCapacity: number,
    private readonly plan: CurveCrawlerMeshPlan,
    sources: readonly CurveCrawlerGpuGeometrySource[],
  ) {
    if (!Number.isInteger(entityCapacity) || entityCapacity <= 0) {
      throw new Error('Curve Crawler GPU 几何容量必须是正整数。');
    }
    this.vertexCount = plan.vertexCount * entityCapacity;
    this.indexCapacity = plan.indexCount * entityCapacity;
    this.positions = new Float32Array(this.vertexCount * 3);
    this.normals = new Float32Array(this.vertexCount * 3);
    this.colors = new Float32Array(this.vertexCount * 4);
    this.slotAndSemantic = new Float32Array(this.vertexCount * 2);
    this.deformation = new Float32Array(this.vertexCount * 4);
    this.pivot = new Float32Array(this.vertexCount * 4);
    this.index = new Uint32Array(this.indexCapacity);
    this.streams = Object.freeze({
      positions: this.positions,
      normals: this.normals,
      colors: this.colors,
    });
    this.deformationStreams = Object.freeze({
      slotAndSemantic: this.slotAndSemantic,
      deformation: this.deformation,
      pivot: this.pivot,
    });
    this.compileSources(sources);
  }

  private compileSources(sources: readonly CurveCrawlerGpuGeometrySource[]): void {
    const bindPose = new CurveCrawlerGpuBindPoseBuilder(this.plan);
    for (const source of sources) {
      if (!Number.isInteger(source.gpuSlotOffset)
        || source.gpuSlotOffset < 0
        || source.gpuSlotOffset + source.state.count > this.entityCapacity) {
        throw new Error('Curve Crawler GPU 几何来源超出固定槽位容量。');
      }
      for (let entityIndex = 0; entityIndex < source.state.count; entityIndex++) {
        const gpuSlot = source.gpuSlotOffset + entityIndex;
        bindPose.write(source.state, entityIndex, this.streams, gpuSlot);
        writeCurveCrawlerGpuDeformationLayout(
          this.plan,
          source.state,
          entityIndex,
          this.streams,
          gpuSlot,
          this.deformationStreams,
        );
      }
    }
  }
}
