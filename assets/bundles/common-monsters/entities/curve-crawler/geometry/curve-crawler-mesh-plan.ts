import { type MeshPlan } from '../../../../../core/mesh/mesh-plan';
import { type CubicTubeSamplePlan } from './kernels/cubic-tube-sample-plan';
import { type EllipsoidSamplePlan } from './kernels/ellipsoid-sample-plan';
import { type FanSamplePlan } from './kernels/fan-sample-plan';

/** Curve Crawler 编译网格中每个最终顶点所属的稳定语义。 */
export enum CurveCrawlerMeshSemantic {
  /** 腿、脚、腹部和胸部。 */
  Body,
  /** 左右两颗眼睛。 */
  Eye,
  /** 死亡后展开和收拢的液体扇面。 */
  Liquid,
  /** 出生时从地面向外延伸的裂缝。 */
  EmergenceCrack,
  /** 出生时生长并发生突起的分面蛋壳。 */
  EmergenceEgg,
  /** 蛋壳爆裂时飞散的低面碎片。 */
  EmergenceShard,
}

/** 身体区域中各个固定体元的局部顶点与索引偏移。 */
export interface CurveCrawlerBodyMeshPlan {
  /** 身体区域占用的最终顶点数量。 */
  readonly vertexCount: number;
  /** 身体区域占用的固定索引数量。 */
  readonly indexCount: number;
  /** 八条腿的管体首顶点偏移。 */
  readonly legVertexOffsets: Uint16Array;
  /** 八个脚端椭球的首顶点偏移。 */
  readonly footVertexOffsets: Uint16Array;
  /** 八条腿的管体首索引偏移。 */
  readonly legIndexOffsets: Uint16Array;
  /** 八个脚端椭球的首索引偏移。 */
  readonly footIndexOffsets: Uint16Array;
  /** 腹部椭球的首顶点偏移。 */
  readonly abdomenVertexOffset: number;
  /** 胸部椭球的首顶点偏移。 */
  readonly thoraxVertexOffset: number;
  /** 腹部椭球的首索引偏移。 */
  readonly abdomenIndexOffset: number;
  /** 胸部椭球的首索引偏移。 */
  readonly thoraxIndexOffset: number;
}

/** 双眼区域中两个椭球的局部顶点与索引偏移。 */
export interface CurveCrawlerEyeMeshPlan {
  /** 双眼区域在单实体计划中的首顶点偏移。 */
  readonly vertexOffset: number;
  /** 双眼区域在单实体计划中的首索引偏移。 */
  readonly indexOffset: number;
  /** 左眼椭球首顶点偏移。 */
  readonly leftVertexOffset: number;
  /** 右眼椭球首顶点偏移。 */
  readonly rightVertexOffset: number;
  /** 左眼椭球首索引偏移。 */
  readonly leftIndexOffset: number;
  /** 右眼椭球首索引偏移。 */
  readonly rightIndexOffset: number;
  /** 双眼区域占用的最终顶点数量。 */
  readonly vertexCount: number;
  /** 双眼区域占用的固定索引数量。 */
  readonly indexCount: number;
}

/** 液体扇面在单实体计划中的局部偏移。 */
export interface CurveCrawlerLiquidMeshPlan {
  /** 液体区域在单实体计划中的首顶点偏移。 */
  readonly vertexOffset: number;
  /** 液体区域在单实体计划中的首索引偏移。 */
  readonly indexOffset: number;
}

/** 地裂、蛋壳与爆裂碎片在单实体计划中的连续布局。 */
export interface CurveCrawlerEmergenceMeshPlan {
  /** 出生区域在单实体计划中的首顶点偏移。 */
  readonly vertexOffset: number;
  /** 出生区域在单实体计划中的首索引偏移。 */
  readonly indexOffset: number;
  /** 出生区域占用的最终顶点数量。 */
  readonly vertexCount: number;
  /** 出生区域占用的固定索引数量。 */
  readonly indexCount: number;
  /** 地裂区域相对出生区域的首顶点偏移。 */
  readonly crackVertexOffset: number;
  /** 分面蛋壳相对出生区域的首顶点偏移。 */
  readonly eggVertexOffset: number;
  /** 分面蛋壳独立三角顶点数量。 */
  readonly eggVertexCount: number;
  /** 分面蛋壳每个独立顶点的单位方向。 */
  readonly eggUnitDirections: Float32Array;
  /** 分面蛋壳独立顶点对应的原始采样点，用于保持接缝扰动一致。 */
  readonly eggSourceVertexIds: Uint16Array;
  /** 每块爆裂碎片相对出生区域的首顶点偏移。 */
  readonly shardVertexOffsets: Uint16Array;
}

/**
 * Curve Crawler 单实体局部固定拓扑与参数采样计划。
 *
 * 所有顶点按一个实体的 Body → Eye → Liquid → Emergence 排列。批渲染器只需复制
 * `indices` 并为每个实体增加 `vertexCount` 偏移，无需重走任何体元拓扑。
 */
export interface CurveCrawlerMeshPlan extends MeshPlan {
  /** 每个最终顶点的领域语义，用于事件驱动的颜色写入。 */
  readonly semanticIds: Uint8Array;
  /** 所有腿共享的三次贝塞尔管体采样计划。 */
  readonly legTube: CubicTubeSamplePlan;
  /** 所有脚端共享的椭球采样计划。 */
  readonly footEllipsoid: EllipsoidSamplePlan;
  /** 腹部和胸部共享的椭球采样计划。 */
  readonly bodyEllipsoid: EllipsoidSamplePlan;
  /** 左右眼共享的椭球采样计划。 */
  readonly eyeEllipsoid: EllipsoidSamplePlan;
  /** 死亡液体共享的中心扇面采样计划。 */
  readonly liquidFan: FanSamplePlan;
  /** 身体区域的连续布局信息。 */
  readonly body: CurveCrawlerBodyMeshPlan;
  /** 双眼区域的连续布局信息。 */
  readonly eyes: CurveCrawlerEyeMeshPlan;
  /** 液体区域的连续布局信息。 */
  readonly liquid: CurveCrawlerLiquidMeshPlan;
  /** 出生地裂、蛋壳和爆裂碎片的连续布局信息。 */
  readonly emergence: CurveCrawlerEmergenceMeshPlan;
}
