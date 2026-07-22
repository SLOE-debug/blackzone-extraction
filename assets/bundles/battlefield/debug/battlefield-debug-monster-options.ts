import { BattlefieldMonsterId } from '../model/battlefield-monster-id';

/** Debug 面板可控制和手动观察的类型化怪物选项。 */
export interface BattlefieldDebugMonsterOption {
  readonly id: BattlefieldMonsterId;
  readonly label: string;
}

const BATTLEFIELD_DEBUG_MONSTER_LABELS = Object.freeze({
  [BattlefieldMonsterId.CurveCrawler]: '异形蜘蛛',
  [BattlefieldMonsterId.VenomLobber]: '毒囊投手',
} satisfies Readonly<Record<BattlefieldMonsterId, string>>);

/** 与 Common Monsters 原型清单一一对应的战场 Debug 选项。 */
export const BATTLEFIELD_DEBUG_MONSTER_OPTIONS = Object.freeze(
  (Object.values(BattlefieldMonsterId) as BattlefieldMonsterId[]).map((id) => Object.freeze({
    id,
    label: BATTLEFIELD_DEBUG_MONSTER_LABELS[id],
  } satisfies BattlefieldDebugMonsterOption)),
);

/** 自动生成按怪物原型保存的多选状态。 */
export type BattlefieldDebugMonsterSelection = Readonly<
  Record<BattlefieldMonsterId, boolean>
>;
