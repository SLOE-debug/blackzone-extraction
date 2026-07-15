import { createEntityRange, type EntityRange } from './entity-range';
import {
  type EntityData,
  type EntitySchema,
  type NumericTypedArray,
} from './entity-schema';

/**
 * 按 Schema 创建并管理固定容量的 Struct of Arrays 实体数据。
 *
 * @typeParam TSchema 决定组件、字段、TypedArray 类型和字段宽度的 Schema。
 */
export class EntityTable<TSchema extends EntitySchema> {
  public readonly data: EntityData<TSchema>;
  public readonly capacity: number;

  private _count = 0;

  constructor(public readonly schema: TSchema, capacity: number) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new Error('实体表容量必须是正整数。');
    }

    this.capacity = capacity;
    this.data = createEntityData(schema, capacity);
  }

  /** 当前已经分配的实体数量。 */
  public get count(): number {
    return this._count;
  }

  /**
   * 从实体表尾部连续分配实体索引。
   *
   * @param count 需要分配的实体数量。
   * @returns 新分配的连续实体范围。
   */
  public allocate(count = 1): EntityRange {
    if (!Number.isInteger(count) || count <= 0) {
      throw new Error('实体分配数量必须是正整数。');
    }
    if (this._count + count > this.capacity) {
      throw new Error('实体表容量不足，无法完成分配。');
    }

    const range = createEntityRange(this._count, count, this.capacity);
    this._count += count;
    return range;
  }

  /** 清空活动实体数量，但保留所有已分配 TypedArray。 */
  public clear(): void {
    this._count = 0;
  }
}

function createEntityData<TSchema extends EntitySchema>(
  schema: TSchema,
  capacity: number,
): EntityData<TSchema> {
  const componentData: Record<string, Record<string, NumericTypedArray>> = {};

  for (const componentName of Object.keys(schema)) {
    const componentSchema = schema[componentName];
    if (componentSchema === undefined) {
      throw new Error(`实体组件定义不存在：${componentName}`);
    }

    const fields: Record<string, NumericTypedArray> = {};
    for (const fieldName of Object.keys(componentSchema)) {
      const fieldDefinition = componentSchema[fieldName];
      if (fieldDefinition === undefined) {
        throw new Error(`实体字段定义不存在：${componentName}.${fieldName}`);
      }
      if (!Number.isInteger(fieldDefinition.width) || fieldDefinition.width <= 0) {
        throw new Error(`实体字段宽度必须是正整数：${componentName}.${fieldName}`);
      }

      fields[fieldName] = new fieldDefinition.arrayType(capacity * fieldDefinition.width);
    }

    componentData[componentName] = fields;
  }

  return componentData as unknown as EntityData<TSchema>;
}
