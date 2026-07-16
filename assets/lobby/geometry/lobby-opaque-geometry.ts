import { type TriangleMeshWriter } from '../../core/geometry/triangle-mesh-writer';
import { writeLobbyAltar } from './lobby-altar-geometry';
import { GeometrySectionComposer } from './infrastructure/geometry-section-composer';
import {
  writeLobbyCharacter,
  writeLobbyCircularFrame,
  writeLobbyCircularPanel,
  writeLobbyLampCable,
  writeLobbyLampGlow,
  writeLobbyLampHousing,
} from './lobby-focus-geometry';
import {
  LOBBY_GLOW_TOPOLOGY,
  LOBBY_OPAQUE_TOPOLOGY,
  LOBBY_OPAQUE_SECTION_ORDER,
  LOBBY_RITUAL_GLOW_TOPOLOGY,
  LobbyOpaqueSection,
  type LobbyOpaqueSectionRanges,
} from './lobby-geometry-topology';
import {
  writeLobbyFloorCracks,
} from './lobby-floor-crack-geometry';
import {
  writeLobbyBackWall,
  writeLobbyCeiling,
  writeLobbyFloor,
  writeLobbyFrontWall,
  writeLobbySideWalls,
} from './lobby-hall-geometry';
import {
  writeLobbyRitualLampGlow,
  writeLobbyRitualLampHousings,
} from './lobby-ritual-lamp-geometry';

/** 按稳定顺序组合大厅全部不透明表面。 */
export class LobbyOpaqueGeometrySource {
  public readonly metrics = LOBBY_OPAQUE_TOPOLOGY;

  /** 写入合并网格并返回供顶点着色使用的连续区段。 */
  public write(writer: TriangleMeshWriter): LobbyOpaqueSectionRanges {
    const startVertex = writer.vertexCount;
    const startIndex = writer.indexCount;
    const sections = new GeometrySectionComposer<LobbyOpaqueSection>(writer);
    sections.write(LobbyOpaqueSection.Floor, () => writeLobbyFloor(writer));
    sections.write(LobbyOpaqueSection.FloorCracks, () => writeLobbyFloorCracks(writer));
    sections.write(LobbyOpaqueSection.Ceiling, () => writeLobbyCeiling(writer));
    sections.write(LobbyOpaqueSection.BackWall, () => writeLobbyBackWall(writer));
    sections.write(LobbyOpaqueSection.FrontWall, () => writeLobbyFrontWall(writer));
    sections.write(LobbyOpaqueSection.SideWalls, () => writeLobbySideWalls(writer));
    sections.write(LobbyOpaqueSection.Altar, () => writeLobbyAltar(writer));
    sections.write(LobbyOpaqueSection.CircularPanel, () => writeLobbyCircularPanel(writer));
    sections.write(LobbyOpaqueSection.CircularFrame, () => writeLobbyCircularFrame(writer));
    sections.write(LobbyOpaqueSection.Character, () => writeLobbyCharacter(writer));
    sections.write(LobbyOpaqueSection.LampCable, () => writeLobbyLampCable(writer));
    sections.write(LobbyOpaqueSection.LampHousing, () => writeLobbyLampHousing(writer));
    sections.write(
      LobbyOpaqueSection.RitualLampHousing,
      () => writeLobbyRitualLampHousings(writer),
    );
    writer.assertWrittenCounts(
      startVertex,
      startIndex,
      this.metrics.verticesPerEntity,
      this.metrics.indicesPerEntity,
    );
    return sections.toRecord(LOBBY_OPAQUE_SECTION_ORDER);
  }
}

/** 写入单独使用无光照材质的灯具发光面。 */
export class LobbyGlowGeometrySource {
  public readonly metrics = LOBBY_GLOW_TOPOLOGY;

  /** 写入固定发光圆盘拓扑。 */
  public write(writer: TriangleMeshWriter): void {
    const startVertex = writer.vertexCount;
    const startIndex = writer.indexCount;
    writeLobbyLampGlow(writer);
    writer.assertWrittenCounts(
      startVertex,
      startIndex,
      this.metrics.verticesPerEntity,
      this.metrics.indicesPerEntity,
    );
  }
}

/** 写入围绕祭台的暗红晶体发光面。 */
export class LobbyRitualGlowGeometrySource {
  public readonly metrics = LOBBY_RITUAL_GLOW_TOPOLOGY;

  /** 写入固定数量的六棱晶体拓扑。 */
  public write(writer: TriangleMeshWriter): void {
    const startVertex = writer.vertexCount;
    const startIndex = writer.indexCount;
    writeLobbyRitualLampGlow(writer);
    writer.assertWrittenCounts(
      startVertex,
      startIndex,
      this.metrics.verticesPerEntity,
      this.metrics.indicesPerEntity,
    );
  }
}

export const lobbyOpaqueGeometry = new LobbyOpaqueGeometrySource();
export const lobbyGlowGeometry = new LobbyGlowGeometrySource();
export const lobbyRitualGlowGeometry = new LobbyRitualGlowGeometrySource();
