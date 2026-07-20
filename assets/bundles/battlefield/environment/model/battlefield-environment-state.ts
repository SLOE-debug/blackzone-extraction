import { EntityTable } from '../../../../core/entities/entity-table';
import {
  BATTLEFIELD_ENVIRONMENT_CATALOG,
  type BattlefieldEnvironmentPrototype,
  type BattlefieldEnvironmentPrototypeDefinition,
} from '../catalog/battlefield-environment-catalog';
import {
  BATTLEFIELD_ENVIRONMENT_SCHEMA,
  type BattlefieldEnvironmentData,
  type BattlefieldEnvironmentTable,
} from './battlefield-environment-schema';

/** 初始化阶段写入环境实体槽位的完整描述。 */
export interface BattlefieldEnvironmentSpawn {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly heading: number;
  readonly scale: number;
  readonly seed: number;
  readonly tintRed: number;
  readonly tintGreen: number;
  readonly tintBlue: number;
  readonly chunkX: number;
  readonly chunkZ: number;
}

/** 一个固定原型的连续 SoA Archetype。 */
export class BattlefieldEnvironmentArchetypeState {
  public readonly table: BattlefieldEnvironmentTable;
  public readonly data: BattlefieldEnvironmentData;
  private activeCount = 0;

  constructor(public readonly definition: BattlefieldEnvironmentPrototypeDefinition) {
    this.table = new EntityTable(BATTLEFIELD_ENVIRONMENT_SCHEMA, definition.capacity);
    this.table.allocate(definition.capacity);
    this.data = this.table.data;
    this.reset();
  }

  /** 该 Archetype 使用的稳定原型标识。 */
  public get prototype(): BattlefieldEnvironmentPrototype {
    return this.definition.prototype;
  }

  /** 固定缓冲包含的实体槽位数量。 */
  public get count(): number {
    return this.table.count;
  }

  /** 当前窗口实际启用的实体数量。 */
  public get enabledCount(): number {
    return this.activeCount;
  }

  /** 清空活动标记并保留所有 TypedArray。 */
  public reset(): void {
    this.activeCount = 0;
    this.data.identity.active.fill(0);
    this.data.transform.scale.fill(0);
    this.data.collision.radius.fill(0);
    this.data.collision.blocksPlayer.fill(0);
  }

  /** 顺序占用一个稳定槽位并写入全部组件。 */
  public spawn(spawn: Readonly<BattlefieldEnvironmentSpawn>): number {
    if (this.activeCount >= this.count) {
      throw new Error(`环境 Archetype 容量不足：${this.prototype}。`);
    }
    const index = this.activeCount;
    const { identity, transform, appearance, collision, chunk } = this.data;
    identity.id[index] = index;
    identity.active[index] = 1;
    identity.randomSeed[index] = spawn.seed >>> 0;
    transform.x[index] = spawn.x;
    transform.y[index] = spawn.y;
    transform.z[index] = spawn.z;
    transform.heading[index] = spawn.heading;
    transform.scale[index] = spawn.scale;
    appearance.tintRed[index] = spawn.tintRed;
    appearance.tintGreen[index] = spawn.tintGreen;
    appearance.tintBlue[index] = spawn.tintBlue;
    collision.radius[index] = this.definition.baseCollisionRadius * spawn.scale;
    collision.blocksPlayer[index] = this.definition.blocksPlayer ? 1 : 0;
    chunk.x[index] = spawn.chunkX;
    chunk.z[index] = spawn.chunkZ;
    this.activeCount += 1;
    return index;
  }
}

/** 聚合全部环境原型 Archetype 的固定容量世界状态。 */
export class BattlefieldEnvironmentWorldState {
  private readonly archetypes = BATTLEFIELD_ENVIRONMENT_CATALOG.map(
    (definition) => new BattlefieldEnvironmentArchetypeState(definition),
  );
  private readonly archetypesByPrototype = new Map(
    this.archetypes.map((state) => [state.prototype, state] as const),
  );

  /** 返回指定稳定原型的连续 SoA 表。 */
  public get(prototype: BattlefieldEnvironmentPrototype): BattlefieldEnvironmentArchetypeState {
    const state = this.archetypesByPrototype.get(prototype);
    if (state === undefined) {
      throw new Error(`环境 Archetype 不存在：${prototype}。`);
    }
    return state;
  }

  /** 清空全部活动槽位但保留底层 TypedArray。 */
  public reset(): void {
    for (const state of this.archetypes) {
      state.reset();
    }
  }

  /** 按稳定顺序遍历全部 Archetype。 */
  public forEach(
    callback: (
      prototype: BattlefieldEnvironmentPrototype,
      state: BattlefieldEnvironmentArchetypeState,
    ) => void,
  ): void {
    for (const definition of BATTLEFIELD_ENVIRONMENT_CATALOG) {
      callback(definition.prototype, this.get(definition.prototype));
    }
  }
}
