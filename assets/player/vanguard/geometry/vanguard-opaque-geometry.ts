import { type EntityRange } from '../../../core/entities/entity-range';
import { type FixedTopologyGeometrySource } from '../../../core/geometry/fixed-topology';
import { type TriangleMeshWriter } from '../../../core/geometry/triangle-mesh-writer';
import { type VanguardState } from '../model/vanguard-state';
import { VanguardFacetedSegmentWriter } from './vanguard-faceted-segment';
import {
  VANGUARD_ARMOR_PARTS,
  VANGUARD_PANEL_PARTS,
  VANGUARD_WEAPON_PARTS,
  type VanguardPartSpec,
} from './vanguard-part-layout';
import { VANGUARD_OPAQUE_TOPOLOGY } from './vanguard-topology';

/** 按黑色主体装甲、深黑战术面板和手枪顺序写入受光表面。 */
export class VanguardOpaqueGeometrySource
implements FixedTopologyGeometrySource<VanguardState> {
  public readonly metrics = VANGUARD_OPAQUE_TOPOLOGY;
  private readonly segmentWriter = new VanguardFacetedSegmentWriter();

  /** 将指定实体范围写入固定拓扑动态装甲层。 */
  public write(writer: TriangleMeshWriter, state: VanguardState, range: EntityRange): void {
    const startVertex = writer.vertexCount;
    const startIndex = writer.indexCount;
    const { morphology } = state.data;

    for (let index = range.start; index < range.end; index++) {
      const armorScale = morphology.armorScale[index] ?? 1;
      const weaponScale = morphology.weaponScale[index] ?? 1;
      this.writeParts(writer, state, index, VANGUARD_ARMOR_PARTS, armorScale);
      this.writeParts(writer, state, index, VANGUARD_PANEL_PARTS, armorScale);
      this.writeParts(writer, state, index, VANGUARD_WEAPON_PARTS, weaponScale);
    }

    writer.assertWrittenCounts(
      startVertex,
      startIndex,
      this.metrics.verticesPerEntity * range.count,
      this.metrics.indicesPerEntity * range.count,
    );
  }

  /** 按配置顺序写入一组同材质语义部件。 */
  private writeParts(
    writer: TriangleMeshWriter,
    state: VanguardState,
    entityIndex: number,
    parts: readonly VanguardPartSpec[],
    scale: number,
  ): void {
    for (const part of parts) {
      this.segmentWriter.append(writer, state, entityIndex, part, scale);
    }
  }
}

/** 主角受光层共享的固定拓扑几何来源。 */
export const vanguardOpaqueGeometry = new VanguardOpaqueGeometrySource();
