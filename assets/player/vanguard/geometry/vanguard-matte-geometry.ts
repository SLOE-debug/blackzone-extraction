import { type EntityRange } from '../../../core/entities/entity-range';
import { type FixedTopologyGeometrySource } from '../../../core/geometry/fixed-topology';
import { type TriangleMeshWriter } from '../../../core/geometry/triangle-mesh-writer';
import { type VanguardState } from '../model/vanguard-state';
import { VanguardCageGeometryWriter } from './vanguard-cage-geometry';
import { VANGUARD_MATTE_CAGE } from './vanguard-model-cage';
import { VANGUARD_MATTE_TOPOLOGY } from './vanguard-topology';

/** 写入连续人体、面部、衣物、头发和围巾的哑光固定拓扑。 */
export class VanguardMatteGeometrySource
implements FixedTopologyGeometrySource<VanguardState> {
  public readonly metrics = VANGUARD_MATTE_TOPOLOGY;
  private readonly cageWriter = new VanguardCageGeometryWriter(VANGUARD_MATTE_CAGE);

  /** 将指定实体范围写入动态哑光表面。 */
  public write(writer: TriangleMeshWriter, state: VanguardState, range: EntityRange): void {
    const startVertex = writer.vertexCount;
    const startIndex = writer.indexCount;
    for (let index = range.start; index < range.end; index++) {
      this.cageWriter.append(writer, state, index);
    }
    writer.assertWrittenCounts(
      startVertex,
      startIndex,
      this.metrics.verticesPerEntity * range.count,
      this.metrics.indicesPerEntity * range.count,
    );
  }
}

/** 主角哑光层共享固定拓扑来源。 */
export const vanguardMatteGeometry = new VanguardMatteGeometrySource();
