import { type TriangleMeshWriter } from '../../core/geometry/triangle-mesh-writer';
import {
  LobbyHallSurfaceId,
  writeLobbyHallSurface,
} from './recipes/lobby-shell-recipe';
import { writeLobbyObservationWall } from './lobby-observation-window-geometry';

/** 写入不规则三角分面的大厅地面。 */
export function writeLobbyFloor(writer: TriangleMeshWriter): void {
  writeLobbyHallSurface(writer, LobbyHallSurfaceId.Floor);
}

/** 写入向大厅内部下探的洞穴式暗色天花板。 */
export function writeLobbyCeiling(writer: TriangleMeshWriter): void {
  writeLobbyHallSurface(writer, LobbyHallSurfaceId.Ceiling);
}

/** 写入角色后方的分面后墙。 */
export function writeLobbyBackWall(writer: TriangleMeshWriter): void {
  writeLobbyObservationWall(writer);
}

/** 写入相机后方的封闭前墙。 */
export function writeLobbyFrontWall(writer: TriangleMeshWriter): void {
  writeLobbyHallSurface(writer, LobbyHallSurfaceId.FrontWall);
}

/** 按稳定顺序写入左右两侧洞穴墙面。 */
export function writeLobbySideWalls(writer: TriangleMeshWriter): void {
  writeLobbyHallSurface(writer, LobbyHallSurfaceId.LeftWall);
  writeLobbyHallSurface(writer, LobbyHallSurfaceId.RightWall);
}
