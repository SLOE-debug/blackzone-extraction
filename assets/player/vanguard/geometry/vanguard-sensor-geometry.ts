import { type EntityRange } from '../../../core/entities/entity-range';
import { type FixedTopologyGeometrySource } from '../../../core/geometry/fixed-topology';
import { type TriangleMeshWriter } from '../../../core/geometry/triangle-mesh-writer';
import { type VanguardState } from '../model/vanguard-state';
import { VanguardEyeRingGeometryWriter } from './vanguard-eye-ring-geometry';
import { VanguardFacetedSegmentWriter } from './vanguard-faceted-segment';
import { VANGUARD_LIGHT_PARTS } from './vanguard-part-layout';
import { VANGUARD_SENSOR_TOPOLOGY } from './vanguard-topology';

/** 写入主角独眼环、镜片、头侧灯和前臂识别灯。 */
export class VanguardSensorGeometrySource
implements FixedTopologyGeometrySource<VanguardState> {
  public readonly metrics = VANGUARD_SENSOR_TOPOLOGY;
  private readonly eyeRingWriter = new VanguardEyeRingGeometryWriter();
  private readonly segmentWriter = new VanguardFacetedSegmentWriter();

  /** 将指定实体范围写入固定拓扑传感器表面。 */
  public write(writer: TriangleMeshWriter, state: VanguardState, range: EntityRange): void {
    const startVertex = writer.vertexCount;
    const startIndex = writer.indexCount;

    for (let index = range.start; index < range.end; index++) {
      const scale = state.data.morphology.armorScale[index] ?? 1;
      this.eyeRingWriter.write(writer, state, index, scale);
      for (const part of VANGUARD_LIGHT_PARTS) {
        this.segmentWriter.append(writer, state, index, part, scale);
      }
    }

    writer.assertWrittenCounts(
      startVertex,
      startIndex,
      this.metrics.verticesPerEntity * range.count,
      this.metrics.indicesPerEntity * range.count,
    );
  }
}

/** 主角发光传感器共享的固定拓扑几何来源。 */
export const vanguardSensorGeometry = new VanguardSensorGeometrySource();
