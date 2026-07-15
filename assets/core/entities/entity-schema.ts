/** 可用于 SoA 实体表的数值 TypedArray。 */
export type NumericTypedArray =
  | Float32Array
  | Float64Array
  | Int8Array
  | Uint8Array
  | Uint8ClampedArray
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array;

/**
 * 描述能够按长度创建 TypedArray 的构造器。
 */
export interface NumericTypedArrayConstructor<TArray extends NumericTypedArray> {
  new(length: number): TArray;
}

/**
 * 描述实体组件中的一个 SoA 数值字段。
 *
 * @typeParam TArray 字段使用的 TypedArray 类型。
 * @typeParam TWidth 每个实体占用的连续分量数量。
 */
export interface EntityFieldDefinition<
  TArray extends NumericTypedArray = NumericTypedArray,
  TWidth extends number = number,
> {
  readonly arrayType: NumericTypedArrayConstructor<TArray>;
  readonly width: TWidth;
}

/** 一个组件所拥有的字段定义。 */
export type EntityComponentSchema = Readonly<Record<string, EntityFieldDefinition>>;

/** 一种实体所拥有的组件定义。 */
export type EntitySchema = Readonly<Record<string, EntityComponentSchema>>;

/** 根据字段定义推导实际 TypedArray 类型。 */
export type EntityFieldArray<TDefinition> =
  TDefinition extends EntityFieldDefinition<infer TArray, number> ? TArray : never;

/** 根据 Schema 推导完整的嵌套 SoA 数据结构。 */
export type EntityData<TSchema extends EntitySchema> = {
  readonly [TComponent in keyof TSchema]: {
    readonly [TField in keyof TSchema[TComponent]]: EntityFieldArray<TSchema[TComponent][TField]>;
  };
};

/**
 * 创建保留 TypedArray 与分量宽度字面量的字段定义。
 *
 * @param arrayType 字段底层 TypedArray 构造器。
 * @param width 每个实体占用的分量数量。
 * @returns 可参与 Schema 推导的字段定义。
 */
export function entityField<TArray extends NumericTypedArray, TWidth extends number>(
  arrayType: NumericTypedArrayConstructor<TArray>,
  width: TWidth,
): EntityFieldDefinition<TArray, TWidth> {
  return Object.freeze({ arrayType, width });
}

/**
 * 定义实体 Schema，同时保留调用点的完整字面量类型。
 *
 * @param schema 按组件分组的字段定义。
 * @returns 未改变结构的强类型 Schema。
 */
export function defineEntitySchema<TSchema extends EntitySchema>(schema: TSchema): TSchema {
  return schema;
}
