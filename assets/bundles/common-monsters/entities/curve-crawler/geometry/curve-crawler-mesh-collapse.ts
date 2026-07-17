import { type VertexStreams } from '../../../../../core/mesh/vertex-streams';
import { type CurveCrawlerMeshPlan } from './curve-crawler-mesh-plan';

/**
 * 将身体和双眼的固定拓扑退化为同一个位置，而不触碰任何索引。
 *
 * 液体具有独立的死亡语义，因此不属于此退化区间。
 */
export function collapseCurveCrawlerBodyAndEyes(
  plan: CurveCrawlerMeshPlan,
  streams: VertexStreams,
  entityVertexOffset: number,
  x: number,
  y: number,
  writePositions: boolean,
  writeNormals: boolean,
): void {
  const collapsedVertexCount = plan.liquid.vertexOffset;
  for (let localVertex = 0; localVertex < collapsedVertexCount; localVertex++) {
    const streamOffset = (entityVertexOffset + localVertex) * 3;
    if (writePositions) {
      streams.positions[streamOffset] = x;
      streams.positions[streamOffset + 1] = y;
      streams.positions[streamOffset + 2] = 0;
    }
    if (writeNormals) {
      streams.normals[streamOffset] = 0;
      streams.normals[streamOffset + 1] = 0;
      streams.normals[streamOffset + 2] = 1;
    }
  }
}
