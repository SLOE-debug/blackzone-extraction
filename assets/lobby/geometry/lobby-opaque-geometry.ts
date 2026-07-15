import { type TriangleMeshWriter } from '../../core/geometry/triangle-mesh-writer';
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
  LobbyOpaqueSection,
  type LobbyOpaqueSectionRanges,
  type LobbyVertexRange,
} from './lobby-geometry-topology';
import {
  writeLobbyBackWall,
  writeLobbyCeiling,
  writeLobbyFloor,
  writeLobbyFrontWall,
  writeLobbySideWalls,
} from './lobby-hall-geometry';

type GeometryWriter = (writer: TriangleMeshWriter) => void;

/** 按稳定顺序组合大厅全部不透明表面。 */
export class LobbyOpaqueGeometrySource {
  public readonly metrics = LOBBY_OPAQUE_TOPOLOGY;

  /** 写入合并网格并返回供顶点着色使用的连续区段。 */
  public write(writer: TriangleMeshWriter): LobbyOpaqueSectionRanges {
    const floor = writeSection(writer, writeLobbyFloor);
    const ceiling = writeSection(writer, writeLobbyCeiling);
    const backWall = writeSection(writer, writeLobbyBackWall);
    const frontWall = writeSection(writer, writeLobbyFrontWall);
    const sideWalls = writeSection(writer, writeLobbySideWalls);
    const circularPanel = writeSection(writer, writeLobbyCircularPanel);
    const circularFrame = writeSection(writer, writeLobbyCircularFrame);
    const character = writeSection(writer, writeLobbyCharacter);
    const lampCable = writeSection(writer, writeLobbyLampCable);
    const lampHousing = writeSection(writer, writeLobbyLampHousing);
    writer.assertCounts(this.metrics.verticesPerEntity, this.metrics.indicesPerEntity);
    return Object.freeze({
      [LobbyOpaqueSection.Floor]: floor,
      [LobbyOpaqueSection.Ceiling]: ceiling,
      [LobbyOpaqueSection.BackWall]: backWall,
      [LobbyOpaqueSection.FrontWall]: frontWall,
      [LobbyOpaqueSection.SideWalls]: sideWalls,
      [LobbyOpaqueSection.CircularPanel]: circularPanel,
      [LobbyOpaqueSection.CircularFrame]: circularFrame,
      [LobbyOpaqueSection.Character]: character,
      [LobbyOpaqueSection.LampCable]: lampCable,
      [LobbyOpaqueSection.LampHousing]: lampHousing,
    });
  }
}

/** 写入单独使用无光照材质的灯具发光面。 */
export class LobbyGlowGeometrySource {
  public readonly metrics = LOBBY_GLOW_TOPOLOGY;

  /** 写入固定发光圆盘拓扑。 */
  public write(writer: TriangleMeshWriter): void {
    writeLobbyLampGlow(writer);
    writer.assertCounts(this.metrics.verticesPerEntity, this.metrics.indicesPerEntity);
  }
}

/** 记录一次几何写入形成的连续顶点范围。 */
function writeSection(
  writer: TriangleMeshWriter,
  writeGeometry: GeometryWriter,
): LobbyVertexRange {
  const startVertex = writer.vertexCount;
  writeGeometry(writer);
  return Object.freeze({
    startVertex,
    vertexCount: writer.vertexCount - startVertex,
  });
}

export const lobbyOpaqueGeometry = new LobbyOpaqueGeometrySource();
export const lobbyGlowGeometry = new LobbyGlowGeometrySource();
