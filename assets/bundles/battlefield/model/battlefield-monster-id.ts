/** 战场正式波次与 Debug 面板共同使用的怪物语义标识。 */
export enum BattlefieldMonsterId {
  CurveCrawler = 'curve-crawler',
  VenomLobber = 'venom-lobber',
}

/** 全部可生成怪物标识；新增类型时必须同步进入强类型集成遍历。 */
export const ALL_BATTLEFIELD_MONSTER_IDS = Object.freeze([
  BattlefieldMonsterId.CurveCrawler,
  BattlefieldMonsterId.VenomLobber,
] as const satisfies readonly BattlefieldMonsterId[]);
