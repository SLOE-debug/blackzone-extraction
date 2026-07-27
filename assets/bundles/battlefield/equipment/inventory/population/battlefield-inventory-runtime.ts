import { type BattlefieldEquipmentLibrary } from '../../catalog/battlefield-equipment-contracts';
import { EquipmentId } from '../../catalog/equipment-id';
import {
  type BattlefieldItemInstance,
  validateBattlefieldItemInstanceSeed,
} from '../../model/battlefield-item-instance';
import {
  BATTLEFIELD_INVENTORY_CAPACITY,
  type BattlefieldInventorySlot,
  type BattlefieldInventorySnapshot,
  type BattlefieldInventoryTransfer,
} from '../model/battlefield-inventory-state';

/** 固定五格物品栏、独立撤离锁定格与稳定装备选择的事务式运行时。 */
export class BattlefieldInventoryRuntime {
  private readonly itemIds: Array<EquipmentId | null> = Array.from(
    { length: BATTLEFIELD_INVENTORY_CAPACITY },
    () => null,
  );
  private readonly stackCounts = new Uint16Array(BATTLEFIELD_INVENTORY_CAPACITY);
  private readonly instanceSeeds = new Uint32Array(BATTLEFIELD_INVENTORY_CAPACITY);
  private readonly occupied = new Uint8Array(BATTLEFIELD_INVENTORY_CAPACITY);
  private securedItemId: EquipmentId | null = null;
  private securedStackCount = 0;
  private securedInstanceSeed = 0;
  private securedOccupied = false;
  private selectedInstanceSeedValue: number | null = null;
  private nextInstanceSeed = 1;
  private revisionValue = 1;

  constructor(private readonly equipmentLibrary: BattlefieldEquipmentLibrary) {}

  public get revision(): number {
    return this.revisionValue;
  }

  /** 当前装备选择绑定永久物品实例，不绑定可变化的格子索引。 */
  public get selectedInstanceSeed(): number | null {
    return this.selectedInstanceSeedValue;
  }

  /**
   * 事务式插入一个完整物品实例。
   *
   * 当前装备均为不可堆叠武器；显式种子已经存在或没有空格时不会改写状态。
   */
  public tryInsert(
    itemId: EquipmentId,
    stackCount = 1,
    instanceSeed?: number,
  ): boolean {
    if (!Number.isSafeInteger(stackCount) || stackCount <= 0) {
      throw new Error('物品栏插入数量必须是正安全整数。');
    }
    const definition = this.equipmentLibrary.get(itemId);
    if (stackCount > definition.maximumStack) {
      throw new Error('单个装备实例数量不能超过原型最大堆叠。');
    }
    const slotIndex = this.findEmptySlot();
    if (slotIndex < 0) {
      return false;
    }
    const resolvedInstanceSeed = instanceSeed ?? this.allocateInstanceSeed();
    validateBattlefieldItemInstanceSeed(resolvedInstanceSeed);
    if (this.containsInstance(resolvedInstanceSeed)) {
      return false;
    }
    this.writeSlot(slotIndex, itemId, stackCount, resolvedInstanceSeed);
    this.invalidate();
    return true;
  }

  /** 选择普通格中的稳定物品实例，传入空值则卸下当前装备。 */
  public selectItem(instanceSeed: number | null): boolean {
    if (instanceSeed !== null) {
      validateBattlefieldItemInstanceSeed(instanceSeed);
      if (this.findOrdinarySlotByInstanceSeed(instanceSeed) < 0) {
        return false;
      }
    }
    if (this.selectedInstanceSeedValue === instanceSeed) {
      return false;
    }
    this.selectedInstanceSeedValue = instanceSeed;
    this.invalidate();
    return true;
  }

  /** 交换两个普通格；装备选择会随实例移动。 */
  public swapSlots(first: number, second: number): boolean {
    this.validateSlotIndex(first);
    this.validateSlotIndex(second);
    if (first === second
      || ((this.occupied[first] ?? 0) === 0 && (this.occupied[second] ?? 0) === 0)) {
      return false;
    }
    const itemId = this.itemIds[first] ?? null;
    const stackCount = this.stackCounts[first] ?? 0;
    const instanceSeed = this.instanceSeeds[first] ?? 0;
    const occupied = this.occupied[first] ?? 0;
    this.itemIds[first] = this.itemIds[second] ?? null;
    this.stackCounts[first] = this.stackCounts[second] ?? 0;
    this.instanceSeeds[first] = this.instanceSeeds[second] ?? 0;
    this.occupied[first] = this.occupied[second] ?? 0;
    this.itemIds[second] = itemId;
    this.stackCounts[second] = stackCount;
    this.instanceSeeds[second] = instanceSeed;
    this.occupied[second] = occupied;
    this.invalidate();
    return true;
  }

  /** 把普通格与撤离锁定格交换；进入锁定格的手持物会立即卸下。 */
  public swapWithSecured(slotIndex: number): boolean {
    this.validateSlotIndex(slotIndex);
    if ((this.occupied[slotIndex] ?? 0) === 0 && !this.securedOccupied) {
      return false;
    }
    const itemId = this.itemIds[slotIndex] ?? null;
    const stackCount = this.stackCounts[slotIndex] ?? 0;
    const instanceSeed = this.instanceSeeds[slotIndex] ?? 0;
    const occupied = (this.occupied[slotIndex] ?? 0) !== 0;
    this.itemIds[slotIndex] = this.securedItemId;
    this.stackCounts[slotIndex] = this.securedStackCount;
    this.instanceSeeds[slotIndex] = this.securedInstanceSeed;
    this.occupied[slotIndex] = this.securedOccupied ? 1 : 0;
    this.securedItemId = itemId;
    this.securedStackCount = stackCount;
    this.securedInstanceSeed = instanceSeed;
    this.securedOccupied = occupied;
    this.clearSelectionWhenUnavailable();
    this.invalidate();
    return true;
  }

  /** 从普通格提取完整实例，供世界丢弃事务提交或回滚。 */
  public extractSlot(slotIndex: number, amount?: number): BattlefieldInventoryTransfer | null {
    this.validateSlotIndex(slotIndex);
    if ((this.occupied[slotIndex] ?? 0) === 0) {
      return null;
    }
    const stackCount = this.stackCounts[slotIndex] ?? 0;
    if (amount !== undefined && amount !== stackCount) {
      throw new Error('当前装备实例不支持拆分堆叠。');
    }
    const itemId = this.itemIds[slotIndex];
    const instanceSeed = this.instanceSeeds[slotIndex] ?? 0;
    if (itemId === null || itemId === undefined || instanceSeed <= 0) {
      throw new Error('物品栏占用格缺少完整装备身份。');
    }
    const transfer = Object.freeze({
      sourceSlotIndex: slotIndex,
      itemId,
      stackCount,
      instanceSeed,
      wasSelected: this.selectedInstanceSeedValue === instanceSeed,
    });
    this.clearSlot(slotIndex);
    if (transfer.wasSelected) {
      this.selectedInstanceSeedValue = null;
    }
    this.invalidate();
    return transfer;
  }

  /** 把失败世界转移恢复到原格，连同原装备选择一起回滚。 */
  public restoreTransfer(transfer: Readonly<BattlefieldInventoryTransfer>): void {
    this.validateSlotIndex(transfer.sourceSlotIndex);
    validateBattlefieldItemInstanceSeed(transfer.instanceSeed);
    if ((this.occupied[transfer.sourceSlotIndex] ?? 0) !== 0
      || this.containsInstance(transfer.instanceSeed)) {
      throw new Error('物品栏转移无法恢复到已占用或重复实例状态。');
    }
    this.writeSlot(
      transfer.sourceSlotIndex,
      transfer.itemId,
      transfer.stackCount,
      transfer.instanceSeed,
    );
    if (transfer.wasSelected) {
      this.selectedInstanceSeedValue = transfer.instanceSeed;
    }
    this.invalidate();
  }

  /** 返回普通格的不可变快照。 */
  public getSlot(slotIndex: number): Readonly<BattlefieldInventorySlot> {
    this.validateSlotIndex(slotIndex);
    return this.createSlotSnapshot(slotIndex);
  }

  /** 返回当前选择对应的稳定物品身份。 */
  public getSelectedItem(): Readonly<BattlefieldItemInstance> | null {
    const seed = this.selectedInstanceSeedValue;
    if (seed === null) {
      return null;
    }
    const slotIndex = this.findOrdinarySlotByInstanceSeed(seed);
    const equipmentId = slotIndex < 0 ? null : this.itemIds[slotIndex];
    return equipmentId === null || equipmentId === undefined
      ? null
      : Object.freeze({ equipmentId, itemInstanceSeed: seed });
  }

  /** 生成 HUD 和结算可长期读取的不可变快照。 */
  public createSnapshot(): Readonly<BattlefieldInventorySnapshot> {
    const slots: Readonly<BattlefieldInventorySlot>[] = [];
    for (let index = 0; index < BATTLEFIELD_INVENTORY_CAPACITY; index++) {
      slots.push(this.createSlotSnapshot(index));
    }
    return Object.freeze({
      slots: Object.freeze(slots),
      secured: Object.freeze({
        itemId: this.securedItemId,
        stackCount: this.securedStackCount,
        instanceSeed: this.securedInstanceSeed,
        occupied: this.securedOccupied,
      }),
      selectedInstanceSeed: this.selectedInstanceSeedValue,
      revision: this.revisionValue,
    });
  }

  private createSlotSnapshot(index: number): Readonly<BattlefieldInventorySlot> {
    const occupied = (this.occupied[index] ?? 0) !== 0;
    return Object.freeze({
      itemId: occupied ? this.itemIds[index] ?? null : null,
      stackCount: occupied ? this.stackCounts[index] ?? 0 : 0,
      instanceSeed: occupied ? this.instanceSeeds[index] ?? 0 : 0,
      occupied,
    });
  }

  private allocateInstanceSeed(): number {
    for (let attempt = 0; attempt < 0xffffffff; attempt++) {
      const seed = this.nextInstanceSeed;
      this.nextInstanceSeed = this.nextInstanceSeed >= 0xffffffff ? 1 : this.nextInstanceSeed + 1;
      if (!this.containsInstance(seed)) {
        return seed;
      }
    }
    throw new Error('物品栏装备实例种子已经耗尽。');
  }

  private findEmptySlot(): number {
    for (let index = 0; index < BATTLEFIELD_INVENTORY_CAPACITY; index++) {
      if ((this.occupied[index] ?? 0) === 0) {
        return index;
      }
    }
    return -1;
  }

  private findOrdinarySlotByInstanceSeed(instanceSeed: number): number {
    for (let index = 0; index < BATTLEFIELD_INVENTORY_CAPACITY; index++) {
      if ((this.occupied[index] ?? 0) !== 0
        && (this.instanceSeeds[index] ?? 0) === instanceSeed) {
        return index;
      }
    }
    return -1;
  }

  private containsInstance(instanceSeed: number): boolean {
    return this.findOrdinarySlotByInstanceSeed(instanceSeed) >= 0
      || (this.securedOccupied && this.securedInstanceSeed === instanceSeed);
  }

  private clearSelectionWhenUnavailable(): void {
    if (this.selectedInstanceSeedValue !== null
      && this.findOrdinarySlotByInstanceSeed(this.selectedInstanceSeedValue) < 0) {
      this.selectedInstanceSeedValue = null;
    }
  }

  private writeSlot(
    slotIndex: number,
    itemId: EquipmentId,
    stackCount: number,
    instanceSeed: number,
  ): void {
    this.itemIds[slotIndex] = itemId;
    this.stackCounts[slotIndex] = stackCount;
    this.instanceSeeds[slotIndex] = instanceSeed;
    this.occupied[slotIndex] = 1;
  }

  private clearSlot(slotIndex: number): void {
    this.itemIds[slotIndex] = null;
    this.stackCounts[slotIndex] = 0;
    this.instanceSeeds[slotIndex] = 0;
    this.occupied[slotIndex] = 0;
  }

  private validateSlotIndex(slotIndex: number): void {
    if (!Number.isSafeInteger(slotIndex)
      || slotIndex < 0
      || slotIndex >= BATTLEFIELD_INVENTORY_CAPACITY) {
      throw new Error('物品栏格索引越界。');
    }
  }

  private invalidate(): void {
    this.revisionValue = this.revisionValue >= Number.MAX_SAFE_INTEGER
      ? 1
      : this.revisionValue + 1;
  }
}
