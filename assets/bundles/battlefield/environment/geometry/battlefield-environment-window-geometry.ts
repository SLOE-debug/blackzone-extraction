import {
  createUnlitColorGeometry,
  GeometryIndexFormat,
  type GeometryBounds,
  type MutableGeometryBounds,
  type UnlitColorBufferGeometry,
} from '../../../../core/geometry/buffer-geometry';
import { type BattlefieldEnvironmentWorldState } from '../model/battlefield-environment-state';
import { type PreparedBattlefieldEnvironmentCatalog } from './battlefield-environment-prepared-catalog';
import {
  copyBattlefieldEnvironmentEntityIndices,
  writeBattlefieldEnvironmentEntity,
} from './battlefield-environment-geometry-writer';

/** 完成后的活动环境窗口单批几何。 */
export interface BattlefieldEnvironmentWindowGeometry {
  readonly geometry: UnlitColorBufferGeometry;
  readonly bounds: GeometryBounds;
  readonly entityCount: number;
}

/**
 * 分帧构建完整活动窗口，但只产出一个 Mesh 所需的连续顶点与索引。
 *
 * 世界状态变化时应废弃当前构建器并重新开始，禁止混合两个窗口的数据。
 */
export class BattlefieldEnvironmentWindowGeometryBuilder {
  private readonly geometry: UnlitColorBufferGeometry;
  private readonly bounds: MutableGeometryBounds = {
    minX: Number.POSITIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY,
    minZ: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    maxY: Number.NEGATIVE_INFINITY,
    maxZ: Number.NEGATIVE_INFINITY,
  };
  private prototypeIndex = 0;
  private entityIndex = 0;
  private targetVertexOffset = 0;
  private targetIndexOffset = 0;
  private complete = false;

  public readonly entityCount: number;

  constructor(
    private readonly world: BattlefieldEnvironmentWorldState,
    private readonly catalog: PreparedBattlefieldEnvironmentCatalog,
  ) {
    let entityCount = 0;
    let vertexCount = 0;
    let indexCount = 0;
    for (const prepared of catalog) {
      const state = world.get(prepared.definition.prototype);
      for (let index = 0; index < state.enabledCount; index++) {
        if ((state.data.identity.active[index] ?? 0) === 0) {
          continue;
        }
        entityCount++;
        vertexCount += prepared.plan.vertexCount;
        indexCount += prepared.plan.indexCount;
      }
    }
    if (entityCount <= 0 || vertexCount <= 0 || indexCount <= 0) {
      throw new Error('环境活动窗口必须至少包含一个可渲染实体。');
    }
    this.entityCount = entityCount;
    this.geometry = createUnlitColorGeometry(
      vertexCount,
      indexCount,
      vertexCount <= 65_535 ? GeometryIndexFormat.Uint16 : GeometryIndexFormat.Uint32,
    );
    this.geometry.commitCounts(vertexCount, indexCount);
  }

  /** 按实体预算推进构建，并返回本轮结束后是否已经完成。 */
  public writeNextEntities(entityBudget: number): boolean {
    if (!Number.isInteger(entityBudget) || entityBudget <= 0) {
      throw new Error('环境窗口构建预算必须是正整数。');
    }
    if (this.complete) {
      return true;
    }
    let written = 0;
    while (this.prototypeIndex < this.catalog.length && written < entityBudget) {
      const prepared = this.catalog[this.prototypeIndex];
      if (prepared === undefined) {
        throw new Error('环境窗口构建器访问了不存在的原型。');
      }
      const state = this.world.get(prepared.definition.prototype);
      while (this.entityIndex < state.enabledCount && written < entityBudget) {
        const sourceIndex = this.entityIndex++;
        if ((state.data.identity.active[sourceIndex] ?? 0) === 0) {
          continue;
        }
        writeBattlefieldEnvironmentEntity(
          state,
          prepared.plan,
          sourceIndex,
          this.geometry,
          this.targetVertexOffset,
          this.bounds,
        );
        copyBattlefieldEnvironmentEntityIndices(
          prepared.plan,
          this.geometry,
          this.targetVertexOffset,
          this.targetIndexOffset,
        );
        this.targetVertexOffset += prepared.plan.vertexCount;
        this.targetIndexOffset += prepared.plan.indexCount;
        written++;
      }
      if (this.entityIndex >= state.enabledCount) {
        this.prototypeIndex++;
        this.entityIndex = 0;
      }
    }
    if (this.prototypeIndex < this.catalog.length) {
      return false;
    }
    if (this.targetVertexOffset !== this.geometry.vertexCount
      || this.targetIndexOffset !== this.geometry.indexCount) {
      throw new Error('环境窗口统一几何的最终写入计数不一致。');
    }
    this.complete = true;
    return true;
  }

  /** 仅在构建完成后返回可交给 GPU 的统一窗口几何。 */
  public finish(): BattlefieldEnvironmentWindowGeometry {
    if (!this.complete) {
      throw new Error('环境窗口几何尚未构建完成。');
    }
    return Object.freeze({
      geometry: this.geometry,
      bounds: Object.freeze({ ...this.bounds }),
      entityCount: this.entityCount,
    });
  }
}
