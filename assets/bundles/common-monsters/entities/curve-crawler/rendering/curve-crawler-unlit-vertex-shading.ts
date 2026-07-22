import { type VertexStreams } from '../../../../../core/mesh/vertex-streams';
import { CurveCrawlerPackedMeshUpdate } from '../geometry/curve-crawler-packed-mesh-update';
import {
  CurveCrawlerMeshSemantic,
  type CurveCrawlerMeshPlan,
} from '../geometry/curve-crawler-mesh-plan';

const LIGHT_DIRECTION_X = -0.36;
const LIGHT_DIRECTION_Y = -0.48;
const LIGHT_DIRECTION_Z = 0.8;
const MATTE_SHADE_LEVELS = Object.freeze([0.64, 0.72, 0.8, 0.88] as const);

/**
 * 将固定世界方向的分档漫反射烘入共享 Unlit 批次的顶点色。
 *
 * Normal 只存在于 CPU 临时流，不会进入 GPU 顶点布局；所有蜘蛛仍由一个
 * Position + Color MeshRenderer 提交。
 */
export function shadeCurveCrawlerUnlitEntities(
  streams: VertexStreams,
  plan: CurveCrawlerMeshPlan,
  firstEntity: number,
  entityCount: number,
): void {
  if (!Number.isInteger(firstEntity)
    || firstEntity < 0
    || !Number.isInteger(entityCount)
    || entityCount < 0) {
    throw new Error('Curve Crawler Unlit 顶点着色实体范围无效。');
  }
  const firstVertex = firstEntity * plan.vertexCount;
  const vertexCount = entityCount * plan.vertexCount;
  const endVertex = firstVertex + vertexCount;
  if (streams.normals.length < endVertex * 3
    || streams.colors.length < endVertex * 4) {
    throw new Error('Curve Crawler Unlit 顶点着色流容量不足。');
  }

  for (let vertex = firstVertex; vertex < endVertex; vertex++) {
    const normalOffset = vertex * 3;
    const normalX = streams.normals[normalOffset] ?? 0;
    const normalY = streams.normals[normalOffset + 1] ?? 0;
    const normalZ = streams.normals[normalOffset + 2] ?? 0;
    const diffuse = Math.max(
      0,
      normalX * LIGHT_DIRECTION_X
        + normalY * LIGHT_DIRECTION_Y
        + normalZ * LIGHT_DIRECTION_Z,
    );
    const shadeLevel = Math.min(
      MATTE_SHADE_LEVELS.length - 1,
      Math.floor(diffuse * MATTE_SHADE_LEVELS.length),
    );
    const bandedShade = MATTE_SHADE_LEVELS[shadeLevel] ?? MATTE_SHADE_LEVELS[0];
    const localVertex = vertex % plan.vertexCount;
    const semantic = plan.semanticIds[localVertex];
    const shade = getSemanticShade(semantic, bandedShade);
    const colorOffset = vertex * 4;
    streams.colors[colorOffset] *= shade;
    streams.colors[colorOffset + 1] *= shade;
    streams.colors[colorOffset + 2] *= shade;
  }
}

/** 只为本帧真正重算颜色的紧凑实体烘焙分面明暗。 */
export function shadeScheduledCurveCrawlerUnlitEntities(
  streams: VertexStreams,
  plan: CurveCrawlerMeshPlan,
  firstEntity: number,
  entityCount: number,
  updates: Uint8Array,
): void {
  if (!Number.isInteger(entityCount)
    || entityCount < 0
    || entityCount > updates.length) {
    throw new Error('Curve Crawler 脏区顶点着色范围无效。');
  }
  for (let entity = 0; entity < entityCount; entity++) {
    if ((updates[entity] as CurveCrawlerPackedMeshUpdate)
      !== CurveCrawlerPackedMeshUpdate.Shaded) {
      continue;
    }
    shadeCurveCrawlerUnlitEntities(streams, plan, firstEntity + entity, 1);
  }
}

/** 保持眼睛和地面效果清晰，只让具有实体体积的表面承担主要明暗。 */
function getSemanticShade(
  semantic: number | undefined,
  surfaceShade: number,
): number {
  switch (semantic) {
    case CurveCrawlerMeshSemantic.Leg:
    case CurveCrawlerMeshSemantic.Foot:
    case CurveCrawlerMeshSemantic.Abdomen:
    case CurveCrawlerMeshSemantic.Thorax:
    case CurveCrawlerMeshSemantic.EmergenceEgg:
    case CurveCrawlerMeshSemantic.EmergenceShard:
      return surfaceShade;
    case CurveCrawlerMeshSemantic.Eye:
      return 0.84 + surfaceShade * 0.16;
    case CurveCrawlerMeshSemantic.Liquid:
    case CurveCrawlerMeshSemantic.EmergenceCrack:
      return 1;
    default:
      throw new Error(`Curve Crawler Unlit 顶点着色包含未知语义：${String(semantic)}。`);
  }
}
