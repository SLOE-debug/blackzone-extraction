import { type TriangleMeshWriter } from '../../core/geometry/triangle-mesh-writer';
import {
  LOBBY_FLOOR_CRACK_PATHS,
  type LobbyFloorCrackPath,
  type LobbyFloorCrackPoint,
} from './lobby-floor-crack-layout';
import {
  appendLobbyGridCell,
  getLobbyGeometryJitter,
  type LobbyPoint3,
} from './lobby-triangle-geometry';

/** 裂纹顶面高度，必须略高于地面最大扰动以避免深度闪烁。 */
const FLOOR_CRACK_HEIGHT = 0.035;

/**
 * 写入略高于地面的固定暗色裂纹带。
 *
 * @param writer 接收独立分面三角形的固定拓扑写入器。
 */
export function writeLobbyFloorCracks(writer: TriangleMeshWriter): void {
  let pathIndex = 0;
  for (const path of LOBBY_FLOOR_CRACK_PATHS) {
    for (let pointIndex = 0; pointIndex < path.points.length - 1; pointIndex++) {
      const startLeft = createCrackEdgePoint(path, pathIndex, pointIndex, 1);
      const endLeft = createCrackEdgePoint(path, pathIndex, pointIndex + 1, 1);
      const endRight = createCrackEdgePoint(path, pathIndex, pointIndex + 1, -1);
      const startRight = createCrackEdgePoint(path, pathIndex, pointIndex, -1);
      appendLobbyGridCell(
        writer,
        startLeft,
        endLeft,
        endRight,
        startRight,
        false,
        false,
      );
    }
    pathIndex++;
  }
}

/**
 * 根据相邻折线方向计算共享裂纹边缘点。
 *
 * @param path 当前裂纹路径。
 * @param pathIndex 路径的稳定索引，仅参与确定性高度扰动。
 * @param pointIndex 当前控制点索引。
 * @param side 相对路径方向的左右侧符号。
 * @returns 位于裂纹带边缘的大厅局部坐标点。
 */
function createCrackEdgePoint(
  path: Readonly<LobbyFloorCrackPath>,
  pathIndex: number,
  pointIndex: number,
  side: -1 | 1,
): LobbyPoint3 {
  const point = getCrackPoint(path, pointIndex);
  const previous = getCrackPoint(path, Math.max(0, pointIndex - 1));
  const next = getCrackPoint(path, Math.min(path.points.length - 1, pointIndex + 1));
  const directionX = next.x - previous.x;
  const directionZ = next.z - previous.z;
  const inverseLength = 1 / Math.max(Math.hypot(directionX, directionZ), 0.000001);
  const halfWidth = path.width * point.widthScale * 0.5;
  const perpendicularX = -directionZ * inverseLength;
  const perpendicularZ = directionX * inverseLength;
  return {
    x: point.x + perpendicularX * halfWidth * side,
    y: FLOOR_CRACK_HEIGHT
      + getLobbyGeometryJitter(pathIndex, pointIndex, 89, 0.003),
    z: point.z + perpendicularZ * halfWidth * side,
  };
}

/**
 * 获取已由路径契约保证存在的裂纹控制点。
 *
 * @param path 当前裂纹路径。
 * @param pointIndex 需要读取的控制点索引。
 * @returns 对应的只读控制点。
 */
function getCrackPoint(
  path: Readonly<LobbyFloorCrackPath>,
  pointIndex: number,
): Readonly<LobbyFloorCrackPoint> {
  const point = path.points[pointIndex];
  if (point === undefined) {
    throw new Error('地面裂纹控制点索引越界。');
  }
  return point;
}
