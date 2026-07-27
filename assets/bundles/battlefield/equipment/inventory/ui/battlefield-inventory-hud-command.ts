/** 物品栏 HUD 向世界输入阶段提交的事务命令种类。 */
export enum BattlefieldInventoryHudCommandKind {
  SelectSlot = 'select-slot',
  SwapSlots = 'swap-slots',
  SwapWithSecured = 'swap-with-secured',
  DiscardSlot = 'discard-slot',
}

/** 单次点击或拖拽产生的一条稳定物品栏命令。 */
export type BattlefieldInventoryHudCommand =
  | Readonly<{
    kind: BattlefieldInventoryHudCommandKind.SelectSlot;
    slotIndex: number;
  }>
  | Readonly<{
    kind: BattlefieldInventoryHudCommandKind.SwapSlots;
    firstSlotIndex: number;
    secondSlotIndex: number;
  }>
  | Readonly<{
    kind: BattlefieldInventoryHudCommandKind.SwapWithSecured;
    slotIndex: number;
  }>
  | Readonly<{
    kind: BattlefieldInventoryHudCommandKind.DiscardSlot;
    slotIndex: number;
  }>;
