import { type TriangleMeshWriter } from '../../core/geometry/triangle-mesh-writer';
import { LOBBY_LAYOUT } from '../model/lobby-layout';
import {
  appendLobbyGridCell,
  getLobbyGeometryJitter,
  type LobbyPoint3,
} from './lobby-triangle-geometry';

/** 写入不规则三角分面的大厅地面。 */
export function writeLobbyFloor(writer: TriangleMeshWriter): void {
  writeHorizontalGrid(writer, 0, 6, 7, 11, 0, true);
}

/** 写入向大厅内部下探的洞穴式暗色天花板。 */
export function writeLobbyCeiling(writer: TriangleMeshWriter): void {
  writeHorizontalGrid(writer, LOBBY_LAYOUT.hallHeight, 10, 7, 23, 0.68, false);
}

/** 写入角色后方的分面后墙。 */
export function writeLobbyBackWall(writer: TriangleMeshWriter): void {
  writeDepthWallGrid(writer, -LOBBY_LAYOUT.hallHalfDepth, 10, 7, 37, 1.35, 1, false);
}

/** 写入相机后方的封闭前墙。 */
export function writeLobbyFrontWall(writer: TriangleMeshWriter): void {
  writeDepthWallGrid(writer, LOBBY_LAYOUT.hallHalfDepth, 10, 7, 41, 0.2, -1, true);
}

/** 按统一拓扑依次写入左右两侧墙面。 */
export function writeLobbySideWalls(writer: TriangleMeshWriter): void {
  writeSideWallGrid(writer, -LOBBY_LAYOUT.hallHalfWidth, 12, 7, 53, 1.45, 1, true);
  writeSideWallGrid(writer, LOBBY_LAYOUT.hallHalfWidth, 12, 7, 61, 1.45, -1, false);
}

/** 写入面向正负 Y 的不规则水平网格。 */
function writeHorizontalGrid(
  writer: TriangleMeshWriter,
  baseY: number,
  columns: number,
  rows: number,
  seed: number,
  caveReliefScale: number,
  faceUp: boolean,
): void {
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const p00 = createHorizontalPoint(
        column, row, columns, rows, baseY, seed, caveReliefScale,
      );
      const p10 = createHorizontalPoint(
        column + 1, row, columns, rows, baseY, seed, caveReliefScale,
      );
      const p11 = createHorizontalPoint(
        column + 1, row + 1, columns, rows, baseY, seed, caveReliefScale,
      );
      const p01 = createHorizontalPoint(
        column, row + 1, columns, rows, baseY, seed, caveReliefScale,
      );
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
  caveReliefScale: number,
): LobbyPoint3 {
  const edge = column === 0 || column === columns || row === 0 || row === rows;
  const tangentialJitter = caveReliefScale > 0 ? 0.18 : 0.07;
  const x = -LOBBY_LAYOUT.hallHalfWidth
    + LOBBY_LAYOUT.hallHalfWidth * 2 * column / columns;
  const z = -LOBBY_LAYOUT.hallHalfDepth
    + LOBBY_LAYOUT.hallHalfDepth * 2 * row / rows;
  return {
    x: x + (edge ? 0 : getLobbyGeometryJitter(
      column,
      row,
      seed,
      tangentialJitter,
    )),
    y: baseY + (caveReliefScale > 0
      ? -caveReliefScale * getCaveWallRelief(column, row, columns, rows, seed)
      : edge ? 0 : getLobbyGeometryJitter(column, row, seed + 1, 0.025)),
    z: z + (edge ? 0 : getLobbyGeometryJitter(
      column,
      row,
      seed + 2,
      tangentialJitter,
    )),
  };
}

/** 写入与 Z 轴垂直的前后墙网格。 */
function writeDepthWallGrid(
  writer: TriangleMeshWriter,
  baseZ: number,
  columns: number,
  rows: number,
  seed: number,
  reliefScale: number,
  inwardDirection: -1 | 1,
  reverseWinding: boolean,
): void {
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const p00 = createDepthWallPoint(
        column, row, columns, rows, baseZ, seed, reliefScale, inwardDirection,
      );
      const p10 = createDepthWallPoint(
        column + 1, row, columns, rows, baseZ, seed, reliefScale, inwardDirection,
      );
      const p11 = createDepthWallPoint(
        column + 1, row + 1, columns, rows, baseZ, seed, reliefScale, inwardDirection,
      );
      const p01 = createDepthWallPoint(
        column, row + 1, columns, rows, baseZ, seed, reliefScale, inwardDirection,
      );
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
  reliefScale: number,
  inwardDirection: -1 | 1,
): LobbyPoint3 {
  const edge = column === 0 || column === columns || row === 0 || row === rows;
  const x = -LOBBY_LAYOUT.hallHalfWidth
    + LOBBY_LAYOUT.hallHalfWidth * 2 * column / columns;
  const y = LOBBY_LAYOUT.hallHeight * row / rows;
  return {
    x: x + (edge ? 0 : getLobbyGeometryJitter(column, row, seed, 0.18)),
    y: y + (edge ? 0 : getLobbyGeometryJitter(column, row, seed + 1, 0.12)),
    z: baseZ + inwardDirection * reliefScale * getCaveWallRelief(
      column,
      row,
      columns,
      rows,
      seed,
    ),
  };
}

/** 写入与 X 轴垂直的左右墙网格。 */
function writeSideWallGrid(
  writer: TriangleMeshWriter,
  baseX: number,
  columns: number,
  rows: number,
  seed: number,
  reliefScale: number,
  inwardDirection: -1 | 1,
  reverseWinding: boolean,
): void {
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const p00 = createSideWallPoint(
        column, row, columns, rows, baseX, seed, reliefScale, inwardDirection,
      );
      const p10 = createSideWallPoint(
        column + 1, row, columns, rows, baseX, seed, reliefScale, inwardDirection,
      );
      const p11 = createSideWallPoint(
        column + 1, row + 1, columns, rows, baseX, seed, reliefScale, inwardDirection,
      );
      const p01 = createSideWallPoint(
        column, row + 1, columns, rows, baseX, seed, reliefScale, inwardDirection,
      );
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
  reliefScale: number,
  inwardDirection: -1 | 1,
): LobbyPoint3 {
  const edge = column === 0 || column === columns || row === 0 || row === rows;
  const z = -LOBBY_LAYOUT.hallHalfDepth
    + LOBBY_LAYOUT.hallHalfDepth * 2 * column / columns;
  const y = LOBBY_LAYOUT.hallHeight * row / rows;
  return {
    x: baseX + inwardDirection * reliefScale * getCaveWallRelief(
      column,
      row,
      columns,
      rows,
      seed,
    ),
    y: y + (edge ? 0 : getLobbyGeometryJitter(column, row, seed + 1, 0.12)),
    z: z + (edge ? 0 : getLobbyGeometryJitter(column, row, seed + 2, 0.18)),
  };
}

/**
 * 计算向大厅内部隆起的确定性岩壁高度。
 *
 * @param column 墙面网格列索引。
 * @param row 墙面网格行索引。
 * @param columns 墙面网格总列数。
 * @param rows 墙面网格总行数。
 * @param seed 当前墙面的固定种子。
 * @returns 相对基础墙面的向内隆起距离；边界始终返回零以封闭大厅。
 */
function getCaveWallRelief(
  column: number,
  row: number,
  columns: number,
  rows: number,
  seed: number,
): number {
  if (column === 0 || column === columns || row === 0 || row === rows) {
    return 0;
  }

  const horizontal = column / columns;
  const vertical = row / rows;
  const edgeFade = Math.sin(Math.PI * horizontal) * Math.sin(Math.PI * vertical);
  const primaryRock = getCaveRockBulge(horizontal, vertical, seed, 17, 0.2, 0.44);
  const secondaryRock = getCaveRockBulge(horizontal, vertical, seed, 31, 0.16, 0.34);
  const ridge = Math.max(0, Math.sin(
    horizontal * Math.PI * 3.2
    - vertical * Math.PI * 2.15
    + seed * 0.23,
  ));
  const detail = getLobbyGeometryJitter(column, row, seed + 73, 0.2);
  const relief = Math.max(
    -0.12,
    0.04 + primaryRock * 1.25 + secondaryRock * 0.85 + ridge * 0.32 + detail,
  );
  return edgeFade * Math.min(1.65, relief);
}

/**
 * 生成由固定 seed 定位的单个宽缓岩体隆起。
 *
 * @param horizontal 墙面横向归一化坐标。
 * @param vertical 墙面纵向归一化坐标。
 * @param seed 当前墙面的固定种子。
 * @param salt 区分不同隆起的固定偏移。
 * @param minimumRadius 隆起在两个方向上的最小半径。
 * @param radiusRange 在最小半径上增加的确定性范围。
 * @returns 当前坐标处处于零到一之间的隆起权重。
 */
function getCaveRockBulge(
  horizontal: number,
  vertical: number,
  seed: number,
  salt: number,
  minimumRadius: number,
  radiusRange: number,
): number {
  const centerX = getCaveParameter(seed, salt, 0.18, 0.64);
  const centerY = getCaveParameter(seed, salt + 1, 0.2, 0.6);
  const radiusX = getCaveParameter(seed, salt + 2, minimumRadius, radiusRange);
  const radiusY = getCaveParameter(seed, salt + 3, minimumRadius, radiusRange);
  const offsetX = (horizontal - centerX) / radiusX;
  const offsetY = (vertical - centerY) / radiusY;
  return Math.exp(-(offsetX * offsetX + offsetY * offsetY) * 1.65);
}

/**
 * 把确定性扰动映射到指定参数区间。
 *
 * @param seed 当前墙面的固定种子。
 * @param salt 当前参数的固定偏移。
 * @param minimum 参数区间下界。
 * @param range 参数区间长度。
 * @returns 位于指定区间内且刷新时保持不变的参数值。
 */
function getCaveParameter(
  seed: number,
  salt: number,
  minimum: number,
  range: number,
): number {
  const normalized = getLobbyGeometryJitter(seed, salt, 101, 0.5) + 0.5;
  return minimum + normalized * range;
}
