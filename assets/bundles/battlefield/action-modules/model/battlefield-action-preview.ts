/** 抓取和投掷共用的世界空间预览类型。 */
export enum BattlefieldActionPreviewType {
  None,
  Grab,
  Throw,
}

/** 世界系统持续写入、UI 投影层持续读取的无分配预览状态。 */
export interface MutableBattlefieldActionPreview {
  type: BattlefieldActionPreviewType;
  active: boolean;
  valid: boolean;
  blocked: boolean;
  startX: number;
  startY: number;
  startZ: number;
  endX: number;
  endY: number;
  endZ: number;
  targetX: number;
  targetY: number;
  targetZ: number;
  impactRadius: number;
  arcHeight: number;
}

export function createBattlefieldActionPreview(): MutableBattlefieldActionPreview {
  return {
    type: BattlefieldActionPreviewType.None,
    active: false,
    valid: false,
    blocked: false,
    startX: 0,
    startY: 0,
    startZ: 0,
    endX: 0,
    endY: 0,
    endZ: 0,
    targetX: 0,
    targetY: 0,
    targetZ: 0,
    impactRadius: 0,
    arcHeight: 0,
  };
}
