import { type Camera, type Material, Node } from 'cc';
import { type FeatureId } from '../../../core/contracts/runtime-id';
import { type RegisteredFeaturePlugin } from '../../../core/features/feature-plugin';
import { type PlanarCrowdSeparationSystem } from '../../../core/monsters/crowd/planar-crowd-separation-system';
import { BattlefieldMonsterId } from '../model/battlefield-monster-id';
import { type BattlefieldMonsterCombatTarget } from '../population/battlefield-monster-contracts';
import { BattlefieldMonsterGroup } from '../population/battlefield-monster-group';
import { type BattlefieldMonsterTargetRegistry } from '../population/battlefield-monster-target-registry';
import {
  type BattlefieldMonsterManipulationRegistry,
} from '../population/battlefield-monster-manipulation-registry';
import { BattlefieldVenomLobberGroup } from '../population/battlefield-venom-lobber-group';

const DEBUG_CURVE_CRAWLER_SEED = 0x51d3b9;
const DEBUG_CURVE_CRAWLER_WORLD_DIAMETER = 0.01;
const DEBUG_CURVE_CRAWLER_POPULATION_ID = 2;
const DEBUG_VENOM_LOBBER_POPULATION_ID = 3;

/** 独立拥有 Debug 观察怪物，确保其生命周期不占用正式波次容量。 */
export class BattlefieldDebugMonsterPopulation {
  private curveCrawler: BattlefieldMonsterGroup | null = null;
  private venomLobber: BattlefieldVenomLobberGroup | null = null;
  private disposed = false;

  constructor(
    private readonly renderRoot: Node,
    private readonly surfaceMaterialTemplate: Material,
    private readonly commonMonsters: RegisteredFeaturePlugin<FeatureId.CommonMonsters>,
    private readonly curveCrawlerBatch: ReturnType<
      RegisteredFeaturePlugin<FeatureId.CommonMonsters>['createCurveCrawlerBatch']
    >,
    private readonly crowd: PlanarCrowdSeparationSystem,
    private readonly targets: BattlefieldMonsterTargetRegistry,
    private readonly manipulations: BattlefieldMonsterManipulationRegistry,
    private readonly camera: Camera,
  ) {}

  public get count(): number {
    return (this.curveCrawler?.count ?? 0) + (this.venomLobber?.count ?? 0);
  }

  /** 独立 Renderer 贡献的可见数量；Curve Crawler 已计入共享批次。 */
  public get separateVisibleCount(): number {
    return this.venomLobber?.visibleCount ?? 0;
  }

  /** 独立 Renderer 贡献的容量；Curve Crawler 已计入共享批次。 */
  public get separateRenderCapacity(): number {
    return this.venomLobber?.count ?? 0;
  }

  public get movementMultiplier(): number {
    return this.venomLobber?.movementMultiplier ?? 1;
  }

  /** 替换同原型的上一只观察实体，并始终启动完整出生生命周期。 */
  public spawn(id: BattlefieldMonsterId, x: number, z: number): void {
    this.ensureActive();
    if (!Number.isFinite(x) || !Number.isFinite(z)) {
      throw new Error('Debug 怪物生成坐标必须是有限数值。');
    }
    const spawners: Readonly<Record<BattlefieldMonsterId, () => void>> = {
      [BattlefieldMonsterId.CurveCrawler]: () => this.spawnCurveCrawler(x, z),
      [BattlefieldMonsterId.VenomLobber]: () => this.spawnVenomLobber(x, z),
    };
    spawners[id]();
  }

  public update(
    deltaTime: number,
    target: Readonly<BattlefieldMonsterCombatTarget> | null,
  ): number {
    if (this.disposed) {
      return 0;
    }
    return (this.curveCrawler?.update(deltaTime, target) ?? 0)
      + (this.venomLobber?.update(deltaTime, target) ?? 0);
  }

  public synchronizePostCrowdPose(): void {
    if (!this.disposed) {
      this.venomLobber?.synchronizePostCrowdPose();
    }
  }

  public synchronizeRendering(): void {
    if (this.disposed) {
      return;
    }
    this.curveCrawler?.synchronizeRendering();
    this.venomLobber?.synchronizeRendering();
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.disposeCurveCrawler();
    this.disposeVenomLobber();
  }

  private spawnCurveCrawler(x: number, z: number): void {
    this.disposeCurveCrawler();
    const group = new BattlefieldMonsterGroup(
      this.curveCrawlerBatch,
      x,
      z,
      1,
      DEBUG_CURVE_CRAWLER_SEED,
      DEBUG_CURVE_CRAWLER_WORLD_DIAMETER,
      1,
      DEBUG_CURVE_CRAWLER_POPULATION_ID,
    );
    this.crowd.register(group.crowdPopulation);
    this.targets.register(group);
    this.manipulations.register(group);
    this.curveCrawler = group;
  }

  private spawnVenomLobber(x: number, z: number): void {
    this.disposeVenomLobber();
    const group = new BattlefieldVenomLobberGroup(
      this.renderRoot,
      this.surfaceMaterialTemplate,
      this.commonMonsters,
      x,
      z,
      DEBUG_VENOM_LOBBER_POPULATION_ID,
      this.camera,
      1,
    );
    if (!group.spawnAt(x, z)) {
      group.dispose();
      throw new Error('Debug Venom Lobber 单槽位未能进入出生生命周期。');
    }
    this.crowd.register(group.crowdPopulation);
    this.targets.register(group);
    this.venomLobber = group;
  }

  private disposeCurveCrawler(): void {
    const group = this.curveCrawler;
    if (group === null) {
      return;
    }
    this.targets.unregister(group);
    this.manipulations.unregister(group);
    this.crowd.unregister(group.populationId);
    group.dispose();
    this.curveCrawler = null;
  }

  private disposeVenomLobber(): void {
    const group = this.venomLobber;
    if (group === null) {
      return;
    }
    this.targets.unregister(group);
    this.crowd.unregister(group.populationId);
    group.dispose();
    this.venomLobber = null;
  }

  private ensureActive(): void {
    if (this.disposed) {
      throw new Error('战场 Debug 怪物群体已经释放。');
    }
  }
}
