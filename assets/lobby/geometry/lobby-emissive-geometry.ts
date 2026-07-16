import { type FixedTopologyMetrics } from '../../core/geometry/fixed-topology';
import { type TriangleMeshWriter } from '../../core/geometry/triangle-mesh-writer';
import {
  lobbyGlowGeometry,
  lobbyRitualGlowGeometry,
} from './lobby-opaque-geometry';

/** 大厅发光合批中的连续顶点范围。 */
export interface LobbyEmissiveVertexRange {
  readonly startVertex: number;
  readonly vertexCount: number;
}

/** 大厅发光合批供顶点着色使用的稳定区段。 */
export interface LobbyEmissiveGeometryRanges {
  readonly lampGlow: LobbyEmissiveVertexRange;
  readonly ritualGlow: LobbyEmissiveVertexRange;
}

/** 顶灯与仪式灯发光面合并后的固定拓扑。 */
export const LOBBY_EMISSIVE_TOPOLOGY = Object.freeze({
  verticesPerEntity: lobbyGlowGeometry.metrics.verticesPerEntity
    + lobbyRitualGlowGeometry.metrics.verticesPerEntity,
  indicesPerEntity: lobbyGlowGeometry.metrics.indicesPerEntity
    + lobbyRitualGlowGeometry.metrics.indicesPerEntity,
}) satisfies FixedTopologyMetrics;

/** 合并不参与实时光照的发光面，不改变大厅真实受光表面。 */
export class LobbyEmissiveGeometrySource {
  public readonly metrics = LOBBY_EMISSIVE_TOPOLOGY;

  /** 按顶灯、仪式灯的顺序写入单个固定拓扑网格。 */
  public write(writer: TriangleMeshWriter): LobbyEmissiveGeometryRanges {
    const lampGlow = writeGeometryRange(writer, () => lobbyGlowGeometry.write(writer));
    const ritualGlow = writeGeometryRange(
      writer,
      () => lobbyRitualGlowGeometry.write(writer),
    );
    writer.assertCounts(this.metrics.verticesPerEntity, this.metrics.indicesPerEntity);
    return Object.freeze({ lampGlow, ritualGlow });
  }
}

/** 记录一次组合写入产生的连续顶点范围。 */
function writeGeometryRange(
  writer: TriangleMeshWriter,
  writeGeometry: () => void,
): LobbyEmissiveVertexRange {
  const startVertex = writer.vertexCount;
  writeGeometry();
  return Object.freeze({
    startVertex,
    vertexCount: writer.vertexCount - startVertex,
  });
}

export const lobbyEmissiveGeometry = new LobbyEmissiveGeometrySource();
