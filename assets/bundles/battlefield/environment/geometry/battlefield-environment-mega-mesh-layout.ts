import { BATTLEFIELD_ENVIRONMENT_PROTOTYPE_CONFIG } from '../model/battlefield-environment-config';
import { type GeometryIndexArray } from '../../../../core/geometry/buffer-geometry';
import {
  BATTLEFIELD_ENVIRONMENT_PROTOTYPES,
  type BattlefieldEnvironmentPrototype,
} from '../model/battlefield-environment-prototype';
import { type BattlefieldEnvironmentMeshPlan } from './battlefield-environment-mesh-plan';
import { BATTLEFIELD_ENVIRONMENT_MESH_PLANS } from './battlefield-environment-mesh-plans';

/** 一个环境原型在统一大网格中的连续固定区段。 */
export interface BattlefieldEnvironmentMegaMeshSection {
  readonly prototype: BattlefieldEnvironmentPrototype;
  readonly plan: BattlefieldEnvironmentMeshPlan;
  readonly entityCapacity: number;
  readonly vertexOffset: number;
  readonly vertexCount: number;
  readonly indexOffset: number;
  readonly indexCount: number;
}

/** 全部环境原型共享的一份固定拓扑布局。 */
export interface BattlefieldEnvironmentMegaMeshLayout {
  readonly sections: readonly BattlefieldEnvironmentMegaMeshSection[];
  readonly vertexCount: number;
  readonly indexCount: number;
}

/** 战场环境无论包含多少原型，都只提交一个渲染批次。 */
export const BATTLEFIELD_ENVIRONMENT_MESH_BATCH_COUNT = 1;

/** 环境大网格的初始化期固定容量与区段偏移。 */
export const BATTLEFIELD_ENVIRONMENT_MEGA_MESH_LAYOUT = createMegaMeshLayout();

/** 将所有原型和实体槽位的局部索引写入同一个 Uint32 索引缓冲。 */
export function writeBattlefieldEnvironmentMegaMeshIndices(
  target: GeometryIndexArray,
  layout: Readonly<BattlefieldEnvironmentMegaMeshLayout>
    = BATTLEFIELD_ENVIRONMENT_MEGA_MESH_LAYOUT,
): void {
  if (!(target instanceof Uint32Array)) {
    throw new Error('战场环境大网格必须使用 Uint32 索引缓冲。');
  }
  if (target.length < layout.indexCount) {
    throw new Error('战场环境大网格索引缓冲容量不足。');
  }

  for (const section of layout.sections) {
    const plan = section.plan;
    for (let entity = 0; entity < section.entityCapacity; entity++) {
      const entityVertexOffset = section.vertexOffset + entity * plan.vertexCount;
      const entityIndexOffset = section.indexOffset + entity * plan.indexCount;
      for (let localIndexOffset = 0; localIndexOffset < plan.indexCount; localIndexOffset++) {
        const localIndex = plan.indices[localIndexOffset];
        if (localIndex === undefined) {
          throw new Error(`环境原型局部索引不存在：${section.prototype}/${localIndexOffset}。`);
        }
        target[entityIndexOffset + localIndexOffset] = entityVertexOffset + localIndex;
      }
    }
  }
}

function createMegaMeshLayout(): BattlefieldEnvironmentMegaMeshLayout {
  const sections: BattlefieldEnvironmentMegaMeshSection[] = [];
  let vertexOffset = 0;
  let indexOffset = 0;

  for (const prototype of BATTLEFIELD_ENVIRONMENT_PROTOTYPES) {
    const plan = BATTLEFIELD_ENVIRONMENT_MESH_PLANS[prototype];
    const entityCapacity = BATTLEFIELD_ENVIRONMENT_PROTOTYPE_CONFIG[prototype].capacity;
    const vertexCount = multiplySafe(plan.vertexCount, entityCapacity, '顶点');
    const indexCount = multiplySafe(plan.indexCount, entityCapacity, '索引');
    sections.push(Object.freeze({
      prototype,
      plan,
      entityCapacity,
      vertexOffset,
      vertexCount,
      indexOffset,
      indexCount,
    }));
    vertexOffset += vertexCount;
    indexOffset += indexCount;
  }

  if (vertexOffset <= 0 || vertexOffset > 0xffffffff) {
    throw new Error('战场环境大网格顶点数量超出 Uint32 索引范围。');
  }
  return Object.freeze({
    sections: Object.freeze(sections),
    vertexCount: vertexOffset,
    indexCount: indexOffset,
  });
}

function multiplySafe(left: number, right: number, description: string): number {
  const result = left * right;
  if (!Number.isSafeInteger(result) || result <= 0) {
    throw new Error(`战场环境大网格${description}容量无效。`);
  }
  return result;
}
