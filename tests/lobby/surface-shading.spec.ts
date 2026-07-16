import { describe, expect, it } from 'vitest';
import {
  createStaticSurfaceGeometry,
  GeometryIndexFormat,
} from '../../assets/core/geometry/buffer-geometry';
import { TriangleMeshWriter } from '../../assets/core/geometry/triangle-mesh-writer';
import {
  lobbyOpaqueGeometry,
  lobbyRitualGlowGeometry,
} from '../../assets/lobby/geometry/lobby-opaque-geometry';
import { LOBBY_FLOOR_CRACK_SEGMENT_COUNT } from '../../assets/lobby/geometry/lobby-floor-crack-layout';
import { LobbyOpaqueSection } from '../../assets/lobby/geometry/lobby-geometry-topology';
import { LOBBY_LAYOUT } from '../../assets/lobby/model/lobby-layout';
import { lobbyVertexShading } from '../../assets/lobby/rendering/lobby-vertex-shading';

describe('大厅表面顶点参数', () => {
  it('按稳定区段写入暗红顶点色并保持完全不透明', () => {
    const geometry = createStaticSurfaceGeometry(
      lobbyOpaqueGeometry.metrics.verticesPerEntity,
      lobbyOpaqueGeometry.metrics.indicesPerEntity,
      GeometryIndexFormat.Uint16,
    );
    const writer = new TriangleMeshWriter(geometry);
    writer.reset(true);
    const ranges = lobbyOpaqueGeometry.write(writer);
    writer.commit();

    lobbyVertexShading.update(geometry, ranges);

    expectDarkRedColor(geometry.colors, ranges[LobbyOpaqueSection.Floor].startVertex);
    expectDarkerThanFloor(
      geometry.colors,
      ranges[LobbyOpaqueSection.Floor].startVertex,
      ranges[LobbyOpaqueSection.FloorCracks].startVertex,
    );
    expectDarkRedColor(geometry.colors, ranges[LobbyOpaqueSection.CircularFrame].startVertex);
    expectDarkRedColor(geometry.colors, ranges[LobbyOpaqueSection.Character].startVertex);
  });

  it('固定生成明显隆起的洞穴墙面与完全一致的地面裂纹', () => {
    const first = createLobbyGeometry();
    const second = createLobbyGeometry();
    const ceiling = first.ranges[LobbyOpaqueSection.Ceiling];
    const backWall = first.ranges[LobbyOpaqueSection.BackWall];
    const frontWall = first.ranges[LobbyOpaqueSection.FrontWall];
    let maximumBackWallZ = Number.NEGATIVE_INFINITY;
    let minimumFrontWallZ = Number.POSITIVE_INFINITY;
    let minimumCeilingY = Number.POSITIVE_INFINITY;
    for (let vertex = ceiling.startVertex; vertex < ceiling.startVertex + ceiling.vertexCount; vertex++) {
      minimumCeilingY = Math.min(
        minimumCeilingY,
        first.geometry.positions[vertex * 3 + 1] ?? 0,
      );
    }
    for (let vertex = backWall.startVertex; vertex < backWall.startVertex + backWall.vertexCount; vertex++) {
      maximumBackWallZ = Math.max(maximumBackWallZ, first.geometry.positions[vertex * 3 + 2] ?? 0);
    }
    for (
      let vertex = frontWall.startVertex;
      vertex < frontWall.startVertex + frontWall.vertexCount;
      vertex++
    ) {
      minimumFrontWallZ = Math.min(
        minimumFrontWallZ,
        first.geometry.positions[vertex * 3 + 2] ?? 0,
      );
    }

    expect(maximumBackWallZ).toBeGreaterThan(-9.7);
    expect(minimumFrontWallZ).toBeGreaterThan(10.5);
    expect(minimumCeilingY).toBeLessThan(8.4);
    expect(Array.from(first.geometry.positions)).toEqual(Array.from(second.geometry.positions));
  });

  it('玩家站在两层不规则祭台顶面且祭台氛围灯保持固定拓扑', () => {
    const fixture = createLobbyGeometry();
    const altar = fixture.ranges[LobbyOpaqueSection.Altar];
    const character = fixture.ranges[LobbyOpaqueSection.Character];
    let maximumAltarY = Number.NEGATIVE_INFINITY;
    let maximumAltarRadius = 0;
    let minimumCharacterY = Number.POSITIVE_INFINITY;
    for (let vertex = altar.startVertex; vertex < altar.startVertex + altar.vertexCount; vertex++) {
      const offset = vertex * 3;
      const x = fixture.geometry.positions[offset] ?? 0;
      const y = fixture.geometry.positions[offset + 1] ?? 0;
      const z = (fixture.geometry.positions[offset + 2] ?? 0) - LOBBY_LAYOUT.focusZ;
      maximumAltarY = Math.max(maximumAltarY, y);
      maximumAltarRadius = Math.max(maximumAltarRadius, Math.hypot(x, z));
    }
    for (
      let vertex = character.startVertex;
      vertex < character.startVertex + character.vertexCount;
      vertex++
    ) {
      minimumCharacterY = Math.min(
        minimumCharacterY,
        fixture.geometry.positions[vertex * 3 + 1] ?? 0,
      );
    }

    expect(maximumAltarY).toBeCloseTo(LOBBY_LAYOUT.altarTopY);
    expect(maximumAltarRadius).toBeGreaterThan(3.2);
    expect(minimumCharacterY).toBeGreaterThan(LOBBY_LAYOUT.altarTopY);

    const glowGeometry = createStaticSurfaceGeometry(
      lobbyRitualGlowGeometry.metrics.verticesPerEntity,
      lobbyRitualGlowGeometry.metrics.indicesPerEntity,
      GeometryIndexFormat.Uint16,
    );
    const glowWriter = new TriangleMeshWriter(glowGeometry);
    glowWriter.reset(true);
    lobbyRitualGlowGeometry.write(glowWriter);
    glowWriter.commit();
    expect(glowGeometry.vertexCount).toBe(lobbyRitualGlowGeometry.metrics.verticesPerEntity);
    expect(glowGeometry.indexCount).toBe(lobbyRitualGlowGeometry.metrics.indicesPerEntity);
  });

  it('地面使用五十段固定裂纹覆盖祭台外围与前后区域', () => {
    expect(LOBBY_FLOOR_CRACK_SEGMENT_COUNT).toBe(50);
  });
});

/** 创建一次完整大厅几何，供确定性与表面高度断言复用。 */
function createLobbyGeometry() {
  const geometry = createStaticSurfaceGeometry(
    lobbyOpaqueGeometry.metrics.verticesPerEntity,
    lobbyOpaqueGeometry.metrics.indicesPerEntity,
    GeometryIndexFormat.Uint16,
  );
  const writer = new TriangleMeshWriter(geometry);
  writer.reset(true);
  const ranges = lobbyOpaqueGeometry.write(writer);
  writer.commit();
  return { geometry, ranges };
}

/** 验证单个顶点使用红色主导且完全不透明的颜色。 */
function expectDarkRedColor(
  colors: Float32Array,
  vertex: number,
): void {
  const colorOffset = vertex * 4;
  const red = colors[colorOffset] ?? 0;
  const green = colors[colorOffset + 1] ?? 0;
  const blue = colors[colorOffset + 2] ?? 0;
  expect(red).toBeGreaterThan(Math.max(green, blue) * 1.8);
  expect(colors[colorOffset + 3]).toBeCloseTo(1);
}

/** 验证裂纹颜色比相邻地面基础色更暗。 */
function expectDarkerThanFloor(
  colors: Float32Array,
  floorVertex: number,
  crackVertex: number,
): void {
  expect(colors[crackVertex * 4] ?? 1).toBeLessThan(colors[floorVertex * 4] ?? 0);
}
