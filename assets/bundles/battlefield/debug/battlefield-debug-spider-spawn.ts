const DEBUG_SPIDER_FORWARD_DISTANCE = 5.2;

/** Debug 动作读取的玩家世界平面锚点。 */
export interface BattlefieldDebugPlayerAnchor {
  readonly positionX: number;
  readonly positionZ: number;
  readonly heading: number;
}

/** 玩家正前方 Debug 蜘蛛的世界平面生成坐标。 */
export interface BattlefieldDebugSpiderSpawnPosition {
  readonly x: number;
  readonly z: number;
}

/** 根据玩家真实朝向计算固定距离的蜘蛛观察点。 */
export function createBattlefieldDebugSpiderSpawnPosition(
  player: Readonly<BattlefieldDebugPlayerAnchor>,
): Readonly<BattlefieldDebugSpiderSpawnPosition> {
  if (!Number.isFinite(player.positionX)
    || !Number.isFinite(player.positionZ)
    || !Number.isFinite(player.heading)) {
    throw new Error('Debug 蜘蛛生成锚点必须使用有限位置和朝向。');
  }
  return Object.freeze({
    x: player.positionX + Math.sin(player.heading) * DEBUG_SPIDER_FORWARD_DISTANCE,
    z: player.positionZ + Math.cos(player.heading) * DEBUG_SPIDER_FORWARD_DISTANCE,
  });
}
