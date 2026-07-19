import { type FixedTopologyMetrics } from '../../core/geometry/fixed-topology';
import { type TriangleMeshWriter } from '../../core/geometry/triangle-mesh-writer';
import {
  lobbyEmissiveGeometry,
  type LobbyEmissiveGeometryRanges,
} from './lobby-emissive-geometry';
import { lobbyTransparentGeometry } from './lobby-transparent-geometry';

/** 大厅同一透明队列批次中的语义顶点范围。 */
export interface LobbyEffectsGeometryRanges {
  readonly emissive: LobbyEmissiveGeometryRanges;
  readonly glass: Readonly<{ startVertex: number; vertexCount: number }>;
}

const LOBBY_EFFECTS_TOPOLOGY = Object.freeze({
  verticesPerEntity: lobbyEmissiveGeometry.metrics.verticesPerEntity
    + lobbyTransparentGeometry.metrics.verticesPerEntity,
  indicesPerEntity: lobbyEmissiveGeometry.metrics.indicesPerEntity
    + lobbyTransparentGeometry.metrics.indicesPerEntity,
}) satisfies FixedTopologyMetrics;

/** 把全不透明发光面与透明观察玻璃合入一次 Alpha 混合提交。 */
export class LobbyEffectsGeometrySource {
  public readonly metrics = LOBBY_EFFECTS_TOPOLOGY;

  public write(writer: TriangleMeshWriter): LobbyEffectsGeometryRanges {
    const emissive = lobbyEmissiveGeometry.write(writer);
    const glassStartVertex = writer.vertexCount;
    lobbyTransparentGeometry.write(writer);
    writer.assertCounts(this.metrics.verticesPerEntity, this.metrics.indicesPerEntity);
    return Object.freeze({
      emissive,
      glass: Object.freeze({
        startVertex: glassStartVertex,
        vertexCount: writer.vertexCount - glassStartVertex,
      }),
    });
  }
}

export const lobbyEffectsGeometry = new LobbyEffectsGeometrySource();
