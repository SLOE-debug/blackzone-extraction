/** Curve Crawler 群体支持的命令类型。 */
export enum CurveCrawlerCommandType {
  Scuttle = 'scuttle',
  Damage = 'damage',
}

/**
 * Curve Crawler 命令使用判别联合，后续可以安全增加带参数的命令分支。
 */
export type CurveCrawlerCommand = Readonly<
  | {
    readonly type: CurveCrawlerCommandType.Scuttle;
  }
  | {
    readonly type: CurveCrawlerCommandType.Damage;
    readonly entityId: number;
    readonly amount: number;
  }
>;
