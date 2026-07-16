import { LOBBY_LAYOUT } from '../model/lobby-layout';

/** 单盏祭台氛围灯的大厅局部位置。 */
export interface LobbyRitualLampPosition {
  readonly x: number;
  readonly z: number;
}

/** 灯座与晶体共享的六边形截面段数。 */
export const LOBBY_RITUAL_LAMP_SEGMENTS = 6;

/** 围绕祭台布置的固定氛围灯位置。 */
export const LOBBY_RITUAL_LAMP_POSITIONS: readonly LobbyRitualLampPosition[] = Object.freeze([
  createLampPosition(-3.7, LOBBY_LAYOUT.focusZ + 1.35),
  createLampPosition(3.7, LOBBY_LAYOUT.focusZ + 1.35),
  createLampPosition(-4.05, LOBBY_LAYOUT.focusZ - 1.45),
  createLampPosition(4.05, LOBBY_LAYOUT.focusZ - 1.45),
  createLampPosition(-2.35, LOBBY_LAYOUT.focusZ - 3.35),
  createLampPosition(2.35, LOBBY_LAYOUT.focusZ - 3.35),
]);

/** 单盏灯座由两段侧壁和一个顶面组成。 */
export const LOBBY_RITUAL_LAMP_HOUSING_TRIANGLES_PER_LIGHT = (
  LOBBY_RITUAL_LAMP_SEGMENTS * 2 * 2
) + LOBBY_RITUAL_LAMP_SEGMENTS;

/** 单盏晶体由上下两个三角形扇面组成。 */
export const LOBBY_RITUAL_LAMP_GLOW_TRIANGLES_PER_LIGHT = LOBBY_RITUAL_LAMP_SEGMENTS * 2;

/** 创建冻结后的祭台氛围灯位置。 */
function createLampPosition(x: number, z: number): LobbyRitualLampPosition {
  return Object.freeze({ x, z });
}
