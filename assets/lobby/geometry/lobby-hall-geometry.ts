import { type TriangleMeshWriter } from '../../core/geometry/triangle-mesh-writer';
import { LOBBY_LAYOUT } from '../model/lobby-layout';
import {
  appendLobbyGridCell,
  getLobbyGeometryJitter,
  type LobbyPoint3,
} from './lobby-triangle-geometry';

/** 写入不规则三角分面的大厅地面。 */
export function writeLobbyFloor(writer: TriangleMeshWriter): void {
  writeHorizontalGrid(writer, 0, 6, 7, 11, true);
}

/** 写入带轻微起伏的暗色天花板。 */
export function writeLobbyCeiling(writer: TriangleMeshWriter): void {
  writeHorizontalGrid(writer, LOBBY_LAYOUT.hallHeight, 6, 5, 23, false);
}

/** 写入角色后方的分面后墙。 */
export function writeLobbyBackWall(writer: TriangleMeshWriter): void {
  writeDepthWallGrid(writer, -LOBBY_LAYOUT.hallHalfDepth, 6, 4, 37, false);
}

/** 写入相机后方的封闭前墙。 */
export function writeLobbyFrontWall(writer: TriangleMeshWriter): void {
  writeDepthWallGrid(writer, LOBBY_LAYOUT.hallHalfDepth, 6, 4, 41, true);
}

/** 按统一拓扑依次写入左右两侧墙面。 */
export function writeLobbySideWalls(writer: TriangleMeshWriter): void {
  writeSideWallGrid(writer, -LOBBY_LAYOUT.hallHalfWidth, 7, 4, 53, true);
  writeSideWallGrid(writer, LOBBY_LAYOUT.hallHalfWidth, 7, 4, 61, false);
}

/** 写入面向正负 Y 的不规则水平网格。 */
function writeHorizontalGrid(
  writer: TriangleMeshWriter,
  baseY: number,
  columns: number,
  rows: number,
  seed: number,
  faceUp: boolean,
): void {
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const p00 = createHorizontalPoint(column, row, columns, rows, baseY, seed);
      const p10 = createHorizontalPoint(column + 1, row, columns, rows, baseY, seed);
      const p11 = createHorizontalPoint(column + 1, row + 1, columns, rows, baseY, seed);
      const p01 = createHorizontalPoint(column, row + 1, columns, rows, baseY, seed);
      appendLobbyGridCell(
        writer,
        p00,
        p10,
        p11,
        p01,
        (column + row) % 2 === 1,
        faceUp,
      );
    }
  }
}

/** 计算水平网格上的共享扰动顶点。 */
function createHorizontalPoint(
  column: number,
  row: number,
  columns: number,
  rows: number,
  baseY: number,
  seed: number,
): LobbyPoint3 {
  const edge = column === 0 || column === columns || row === 0 || row === rows;
  const x = -LOBBY_LAYOUT.hallHalfWidth
    + LOBBY_LAYOUT.hallHalfWidth * 2 * column / columns;
  const z = -LOBBY_LAYOUT.hallHalfDepth
    + LOBBY_LAYOUT.hallHalfDepth * 2 * row / rows;
  return {
    x: x + (edge ? 0 : getLobbyGeometryJitter(column, row, seed, 0.14)),
    y: baseY + (edge ? 0 : getLobbyGeometryJitter(column, row, seed + 1, 0.07)),
    z: z + (edge ? 0 : getLobbyGeometryJitter(column, row, seed + 2, 0.16)),
  };
}

/** 写入与 Z 轴垂直的前后墙网格。 */
function writeDepthWallGrid(
  writer: TriangleMeshWriter,
  baseZ: number,
  columns: number,
  rows: number,
  seed: number,
  reverseWinding: boolean,
): void {
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const p00 = createDepthWallPoint(column, row, columns, rows, baseZ, seed);
      const p10 = createDepthWallPoint(column + 1, row, columns, rows, baseZ, seed);
      const p11 = createDepthWallPoint(column + 1, row + 1, columns, rows, baseZ, seed);
      const p01 = createDepthWallPoint(column, row + 1, columns, rows, baseZ, seed);
      appendLobbyGridCell(
        writer,
        p00,
        p10,
        p11,
        p01,
        (column + row) % 2 === 0,
        reverseWinding,
      );
    }
  }
}

/** 计算前后墙共享的分面顶点。 */
function createDepthWallPoint(
  column: number,
  row: number,
  columns: number,
  rows: number,
  baseZ: number,
  seed: number,
): LobbyPoint3 {
  const edge = column === 0 || column === columns || row === 0 || row === rows;
  const x = -LOBBY_LAYOUT.hallHalfWidth
    + LOBBY_LAYOUT.hallHalfWidth * 2 * column / columns;
  const y = LOBBY_LAYOUT.hallHeight * row / rows;
  return {
    x: x + (edge ? 0 : getLobbyGeometryJitter(column, row, seed, 0.16)),
    y: y + (edge ? 0 : getLobbyGeometryJitter(column, row, seed + 1, 0.12)),
    z: baseZ + (edge ? 0 : getLobbyGeometryJitter(column, row, seed + 2, 0.09)),
  };
}

/** 写入与 X 轴垂直的左右墙网格。 */
function writeSideWallGrid(
  writer: TriangleMeshWriter,
  baseX: number,
  columns: number,
  rows: number,
  seed: number,
  reverseWinding: boolean,
): void {
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const p00 = createSideWallPoint(column, row, columns, rows, baseX, seed);
      const p10 = createSideWallPoint(column + 1, row, columns, rows, baseX, seed);
      const p11 = createSideWallPoint(column + 1, row + 1, columns, rows, baseX, seed);
      const p01 = createSideWallPoint(column, row + 1, columns, rows, baseX, seed);
      appendLobbyGridCell(
        writer,
        p00,
        p10,
        p11,
        p01,
        (column + row) % 2 === 1,
        reverseWinding,
      );
    }
  }
}

/** 计算左右墙共享的分面顶点。 */
function createSideWallPoint(
  column: number,
  row: number,
  columns: number,
  rows: number,
  baseX: number,
  seed: number,
): LobbyPoint3 {
  const edge = column === 0 || column === columns || row === 0 || row === rows;
  const z = -LOBBY_LAYOUT.hallHalfDepth
    + LOBBY_LAYOUT.hallHalfDepth * 2 * column / columns;
  const y = LOBBY_LAYOUT.hallHeight * row / rows;
  return {
    x: baseX + (edge ? 0 : getLobbyGeometryJitter(column, row, seed, 0.09)),
    y: y + (edge ? 0 : getLobbyGeometryJitter(column, row, seed + 1, 0.12)),
    z: z + (edge ? 0 : getLobbyGeometryJitter(column, row, seed + 2, 0.16)),
  };
}
