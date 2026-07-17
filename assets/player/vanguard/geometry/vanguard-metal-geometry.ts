import { type EntityRange } from '../../../core/entities/entity-range';
import { type FixedTopologyGeometrySource } from '../../../core/geometry/fixed-topology';
import { type TriangleMeshWriter } from '../../../core/geometry/triangle-mesh-writer';
import { type VanguardState } from '../model/vanguard-state';
import { VanguardCageGeometryWriter } from './vanguard-cage-geometry';
import { VANGUARD_METAL_CAGE } from './vanguard-model-cage';
import { VANGUARD_METAL_TOPOLOGY } from './vanguard-topology';

/** 写入长剑、护手、剑首与腰带扣件的金属固定拓扑。 */
export class VanguardMetalGeometrySource
implements FixedTopologyGeometrySource<VanguardState> {
  public readonly metrics = VANGUARD_METAL_TOPOLOGY;
  private readonly cageWriter = new VanguardCageGeometryWriter(VANGUARD_METAL_CAGE);

  /** 将指定实体范围写入动态金属表面。 */
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

/** 主角金属层共享固定拓扑来源。 */
export const vanguardMetalGeometry = new VanguardMetalGeometrySource();
