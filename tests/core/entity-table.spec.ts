import { describe, expect, it } from 'vitest';
import { defineEntitySchema, entityField } from '../../assets/core/entities/entity-schema';
import { EntityTable } from '../../assets/core/entities/entity-table';

describe('EntityTable', () => {
  const schema = defineEntitySchema({
    transform: {
      x: entityField(Float32Array, 1),
      direction: entityField(Float32Array, 2),
    },
    state: {
      kind: entityField(Uint8Array, 1),
    },
  } as const);

  it('按字段宽度创建推导后的 TypedArray', () => {
    const table = new EntityTable(schema, 4);

    expect(table.data.transform.x).toBeInstanceOf(Float32Array);
    expect(table.data.transform.x.length).toBe(4);
    expect(table.data.transform.direction.length).toBe(8);
    expect(table.data.state.kind).toBeInstanceOf(Uint8Array);
  });

  it('连续分配实体范围并阻止容量越界', () => {
    const table = new EntityTable(schema, 3);

    expect(table.allocate(2)).toEqual({ start: 0, count: 2, end: 2 });
    expect(table.allocate()).toEqual({ start: 2, count: 1, end: 3 });
    expect(() => table.allocate()).toThrow(/容量不足/);
  });

  it('拒绝非法容量和字段宽度', () => {
    expect(() => new EntityTable(schema, 0)).toThrow(/正整数/);

    const invalidSchema = defineEntitySchema({
      invalid: {
        value: entityField(Float32Array, 0),
      },
    } as const);
    expect(() => new EntityTable(invalidSchema, 1)).toThrow(/字段宽度/);
  });
});
