import { type Material, Node } from 'cc';
import { type Disposable } from '../../../core/contracts/disposable';
import { FeatureId } from '../../../core/contracts/runtime-id';
import { type RegisteredFeaturePlugin } from '../../../core/features/feature-plugin';
import {
  type ChunkRuntimeParticipant,
  type ChunkRuntimeScope,
} from '../../../core/world/chunk-runtime-registry';
import { BattlefieldEnvironmentPopulation } from '../environment/population/battlefield-environment-population';
import {
  BATTLEFIELD_MONSTER_SPAWN,
  createBattlefieldMonsterSpawn,
} from '../model/battlefield-monster-spawn';
import {
  type BattlefieldMonsterCombatTarget,
  type MutableBattlefieldAimTarget,
} from './battlefield-monster-contracts';
import { BattlefieldMonsterGroup } from './battlefield-monster-group';

const DEBUG_CURVE_CRAWLER_SEED = 0x51d3b9;
const DEBUG_CURVE_CRAWLER_WORLD_DIAMETER = 0.01;

export type {
  BattlefieldMonsterCombatTarget,
  MutableBattlefieldAimTarget,
} from './battlefield-monster-contracts';

/**
 * 聚合活动 Chunk 中的全部地图随机怪物群体。
 *
 * 每个群体的真实所有权位于创建它的 ChunkRuntimeScope；本类只负责跨群体更新、
 * 战斗汇总和瞄准查询，不再把旧群体迁移到其他 Chunk。
 */
export class BattlefieldMonsterPopulation
implements ChunkRuntimeParticipant<BattlefieldEnvironmentPopulation>, Disposable {
  private readonly groups: BattlefieldMonsterGroup[] = [];
  private readonly aimCandidate: MutableBattlefieldAimTarget = { x: 0, z: 0 };
  private debugGroup: BattlefieldMonsterGroup | null = null;
  private disposed = false;

  constructor(
    private readonly parent: Node,
    private readonly surfaceMaterialTemplate: Material,
    private readonly commonMonsters: RegisteredFeaturePlugin<FeatureId.CommonMonsters>,
  ) {}

  /** 当前所有活动 Chunk 中的怪物总数。 */
  public get count(): number {
    let count = 0;
    for (const group of this.groups) {
      count += group.count;
    }
    return count;
  }

  /** 为新加载 Chunk 创建确定性随机群体并交给该 Chunk 作用域持有。 */
  public populate(
    scope: ChunkRuntimeScope,
    _environment: BattlefieldEnvironmentPopulation,
  ): void {
    this.ensureActive();
    const spawn = createBattlefieldMonsterSpawn(scope.chunk);
    if (spawn === null) {
      return;
    }
    const group = new BattlefieldMonsterGroup(
      this.parent,
      this.surfaceMaterialTemplate,
      this.commonMonsters,
      spawn.x,
      spawn.z,
      spawn.count,
      spawn.seed,
      BATTLEFIELD_MONSTER_SPAWN.worldDiameter,
    );
    this.groups.push(group);
    scope.own(new BattlefieldMonsterGroupOwnership(this.groups, group));
  }

  /**
   * 在精确世界坐标创建一只用于观察出生演出的蜘蛛。
   *
   * 再次触发时先替换旧观察实体，避免调试点击持续积累完整怪物批次。
   */
  public spawnDebugCurveCrawler(x: number, z: number): void {
    this.ensureActive();
    if (!Number.isFinite(x) || !Number.isFinite(z)) {
      throw new Error('Debug 蜘蛛生成坐标必须是有限数值。');
    }
    if (this.debugGroup !== null) {
      removeMonsterGroup(this.groups, this.debugGroup);
      this.debugGroup.dispose();
    }
    const group = new BattlefieldMonsterGroup(
      this.parent,
      this.surfaceMaterialTemplate,
      this.commonMonsters,
      x,
      z,
      1,
      DEBUG_CURVE_CRAWLER_SEED,
      DEBUG_CURVE_CRAWLER_WORLD_DIAMETER,
    );
    this.groups.push(group);
    this.debugGroup = group;
  }

  /** 推进全部活动地图群体并汇总本帧伤害。 */
  public update(
    deltaTime: number,
    target: Readonly<BattlefieldMonsterCombatTarget> | null,
  ): number {
    if (this.disposed) {
      return 0;
    }
    let damage = 0;
    for (const group of this.groups) {
      damage += group.update(deltaTime, target);
    }
    return damage;
  }

  /** 在所有活动地图群体中选择距离玩家最近的有效瞄准吸附结果。 */
  public resolveAimTarget(
    originX: number,
    originZ: number,
    directionX: number,
    directionZ: number,
    result: MutableBattlefieldAimTarget,
  ): boolean {
    if (this.disposed) {
      return false;
    }
    let found = false;
    let bestDistanceSquared = Number.POSITIVE_INFINITY;
    for (const group of this.groups) {
      if (!group.writeAimTarget(
        originX,
        originZ,
        directionX,
        directionZ,
        this.aimCandidate,
      )) {
        continue;
      }
      const deltaX = this.aimCandidate.x - originX;
      const deltaZ = this.aimCandidate.z - originZ;
      const distanceSquared = deltaX * deltaX + deltaZ * deltaZ;
      if (distanceSquared < bestDistanceSquared) {
        result.x = this.aimCandidate.x;
        result.z = this.aimCandidate.z;
        bestDistanceSquared = distanceSquared;
        found = true;
      }
    }
    return found;
  }

  /** 兜底释放仍登记的群体；正常流程会先由 Chunk 注册表清空作用域。 */
  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    while (this.groups.length > 0) {
      this.groups.pop()?.dispose();
    }
    this.debugGroup = null;
  }

  private ensureActive(): void {
    if (this.disposed) {
      throw new Error('战场怪物聚合群体已经释放。');
    }
  }
}

/** 在作用域卸载时同时释放群体并从聚合查询列表移除。 */
class BattlefieldMonsterGroupOwnership implements Disposable {
  private disposed = false;

  constructor(
    private readonly groups: BattlefieldMonsterGroup[],
    private readonly group: BattlefieldMonsterGroup,
  ) {}

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    removeMonsterGroup(this.groups, this.group);
    this.group.dispose();
  }
}

/** 从聚合更新列表移除指定群体。 */
function removeMonsterGroup(
  groups: BattlefieldMonsterGroup[],
  group: BattlefieldMonsterGroup,
): void {
  const index = groups.indexOf(group);
  if (index >= 0) {
    groups.splice(index, 1);
  }
}
