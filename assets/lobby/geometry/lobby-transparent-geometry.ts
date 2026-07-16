import { type FixedTopologyMetrics } from '../../core/geometry/fixed-topology';
import { type TriangleMeshWriter } from '../../core/geometry/triangle-mesh-writer';
import {
  LOBBY_OBSERVATION_GLASS_TRIANGLES,
  writeLobbyObservationGlass,
} from './lobby-observation-window-geometry';

const LOBBY_TRANSPARENT_TOPOLOGY = Object.freeze({
  verticesPerEntity: LOBBY_OBSERVATION_GLASS_TRIANGLES * 3,
  indicesPerEntity: LOBBY_OBSERVATION_GLASS_TRIANGLES * 3,
}) satisfies FixedTopologyMetrics;

/** 提供大厅透明观察面的固定拓扑。 */
export class LobbyTransparentGeometrySource {
  public readonly metrics = LOBBY_TRANSPARENT_TOPOLOGY;

  /** 写入覆盖后墙圆形洞口的透明面。 */
  public write(writer: TriangleMeshWriter): void {
    const startVertex = writer.vertexCount;
    const startIndex = writer.indexCount;
    writeLobbyObservationGlass(writer);
    writer.assertWrittenCounts(
      startVertex,
      startIndex,
      this.metrics.verticesPerEntity,
      this.metrics.indicesPerEntity,
    );
  }
}

export const lobbyTransparentGeometry = new LobbyTransparentGeometrySource();
