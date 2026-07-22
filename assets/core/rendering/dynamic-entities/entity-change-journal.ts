import { EntityRenderDirty } from './entity-render-dirty';

/**
 * 保存固定容量实体的渲染变化位标志。
 *
 * 领域系统在写入组件时追加标志；渲染器只清理已经成功处理的实体和属性。
 */
export class EntityChangeJournal {
  private readonly changes: Uint8Array;

  constructor(capacity: number, initial = EntityRenderDirty.None) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new Error('实体变化日志容量必须是正整数。');
    }
    assertDirtyFlags(initial);
    this.changes = new Uint8Array(capacity);
    if (initial !== EntityRenderDirty.None) {
      this.changes.fill(initial);
    }
  }

  /** 日志覆盖的固定实体槽位数量。 */
  public get capacity(): number {
    return this.changes.length;
  }

  /** 为单个实体追加一个或多个变化标志。 */
  public mark(entityIndex: number, dirty: EntityRenderDirty): void {
    this.assertEntityIndex(entityIndex);
    assertDirtyFlags(dirty);
    this.changes[entityIndex] = (this.changes[entityIndex] ?? 0) | dirty;
  }

  /** 为全部实体追加相同变化标志。 */
  public markAll(dirty: EntityRenderDirty): void {
    assertDirtyFlags(dirty);
    for (let entityIndex = 0; entityIndex < this.changes.length; entityIndex++) {
      this.changes[entityIndex] = (this.changes[entityIndex] ?? 0) | dirty;
    }
  }

  /** 读取一个实体尚未被渲染器消费的变化标志。 */
  public read(entityIndex: number): EntityRenderDirty {
    this.assertEntityIndex(entityIndex);
    return (this.changes[entityIndex] ?? EntityRenderDirty.None) as EntityRenderDirty;
  }

  /** 只清理已经成功处理的指定变化标志。 */
  public clear(entityIndex: number, dirty: EntityRenderDirty): void {
    this.assertEntityIndex(entityIndex);
    assertDirtyFlags(dirty);
    this.changes[entityIndex] = (this.changes[entityIndex] ?? 0) & ~dirty;
  }

  /** 清空全部实体变化，供完整重写整个独占批次后使用。 */
  public clearAll(): void {
    this.changes.fill(EntityRenderDirty.None);
  }

  /** 返回当前是否至少有一个实体包含指定变化。 */
  public hasAny(dirty: EntityRenderDirty): boolean {
    assertDirtyFlags(dirty);
    for (let entityIndex = 0; entityIndex < this.changes.length; entityIndex++) {
      if (((this.changes[entityIndex] ?? 0) & dirty) !== 0) {
        return true;
      }
    }
    return false;
  }

  private assertEntityIndex(entityIndex: number): void {
    if (!Number.isInteger(entityIndex)
      || entityIndex < 0
      || entityIndex >= this.changes.length) {
      throw new Error('实体变化日志槽位越界。');
    }
  }
}

function assertDirtyFlags(dirty: EntityRenderDirty): void {
  if (!Number.isInteger(dirty) || dirty < 0 || (dirty & ~EntityRenderDirty.All) !== 0) {
    throw new Error('实体渲染变化标志无效。');
  }
}
