import { type BattlefieldEquipmentLibrary } from '../../catalog/battlefield-equipment-contracts';
import { EquipmentId } from '../../catalog/equipment-id';
import {
  BATTLEFIELD_INVENTORY_CAPACITY,
  type BattlefieldInventorySlot,
  type BattlefieldInventorySnapshot,
} from '../model/battlefield-inventory-state';

/** 固定五格物品栏与独立撤离锁定格的事务式运行时。 */
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
  private nextInstanceSeed = 1;
  private revisionValue = 1;

  constructor(private readonly equipmentLibrary: BattlefieldEquipmentLibrary) {}

  public get revision(): number {
    return this.revisionValue;
  }

  /**
   * 事务式插入整组物品。
   *
   * 容量不足时不会改写任何格子，调用方因此可以安全保留地面物品。
   */
  public tryInsert(
    itemId: EquipmentId,
    stackCount = 1,
    instanceSeed?: number,
  ): boolean {
    if (!Number.isSafeInteger(stackCount) || stackCount <= 0
      || (instanceSeed !== undefined
        && (!Number.isSafeInteger(instanceSeed) || instanceSeed <= 0))) {
      throw new Error('物品栏插入数量和实例种子必须为正安全整数。');
    }
    const definition = this.equipmentLibrary.get(itemId);
    const maximumStack = definition.maximumStack;
    let available = 0;
    for (let index = 0; index < BATTLEFIELD_INVENTORY_CAPACITY; index++) {
      if ((this.occupied[index] ?? 0) === 0) {
        available += maximumStack;
      } else if (this.itemIds[index] === itemId) {
        available += Math.max(0, maximumStack - (this.stackCounts[index] ?? 0));
      }
    }
    if (available < stackCount) {
      return false;
    }
    const resolvedInstanceSeed = instanceSeed ?? this.allocateInstanceSeed();

    let remaining = stackCount;
    for (let index = 0; index < BATTLEFIELD_INVENTORY_CAPACITY && remaining > 0; index++) {
      if ((this.occupied[index] ?? 0) === 0 || this.itemIds[index] !== itemId) {
        continue;
      }
      const current = this.stackCounts[index] ?? 0;
      const inserted = Math.min(remaining, maximumStack - current);
      this.stackCounts[index] = current + inserted;
      remaining -= inserted;
    }
    for (let index = 0; index < BATTLEFIELD_INVENTORY_CAPACITY && remaining > 0; index++) {
      if ((this.occupied[index] ?? 0) !== 0) {
        continue;
      }
      const inserted = Math.min(remaining, maximumStack);
      this.itemIds[index] = itemId;
      this.stackCounts[index] = inserted;
      this.instanceSeeds[index] = resolvedInstanceSeed;
      this.occupied[index] = 1;
      remaining -= inserted;
    }
    this.invalidate();
    return true;
  }

  /** 把普通格与撤离锁定格交换，保证锁定格始终不挤占普通容量。 */
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
    this.invalidate();
    return true;
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
    const seed = this.nextInstanceSeed;
    this.nextInstanceSeed = this.nextInstanceSeed >= 0xffffffff
      ? 1
      : this.nextInstanceSeed + 1;
    return seed;
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
