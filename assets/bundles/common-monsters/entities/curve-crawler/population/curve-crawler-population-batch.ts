import { type Camera, type Material, Node } from 'cc';
import { type CurveCrawlerPopulationOptions } from '../model/curve-crawler-options';
import { CurveCrawlerMotionProfile } from '../model/curve-crawler-motion-profile';
import { CurveCrawlerSharedRenderer } from '../rendering/curve-crawler-shared-renderer';
import { CurveCrawlerPopulation } from './curve-crawler-population';

/** 共享批次已经固定材质模板，群体创建参数只保留领域配置。 */
export type CurveCrawlerBatchPopulationOptions = Omit<
  CurveCrawlerPopulationOptions,
  'surfaceMaterialTemplate'
>;

/** 为多个自主群体提供独立模拟、单一 MeshRenderer 的创建门面。 */
export class CurveCrawlerPopulationBatch {
  private readonly rendering: CurveCrawlerSharedRenderer;
  private disposed = false;

  constructor(
    parent: Node,
    private readonly surfaceMaterialTemplate: Material,
    camera: Camera,
  ) {
    this.rendering = new CurveCrawlerSharedRenderer(
      parent,
      surfaceMaterialTemplate,
      camera,
    );
  }

  /** 当前具有可渲染生命周期并进入共享批次的实体数量。 */
  public get visibleEntityCount(): number {
    return this.rendering.visibleEntityCount;
  }

  /** 当前仍具有可渲染生命周期、但不一定处于镜头内的实体数量。 */
  public get residentCount(): number {
    return this.rendering.residentCount;
  }

  /** 最近一次共享同步实际求值的实体数量。 */
  public get lastEvaluatedEntityCount(): number {
    return this.rendering.lastEvaluatedEntityCount;
  }

  /** 最近一次共享同步上传的位置流字节数。 */
  public get lastPositionUploadBytes(): number {
    return this.rendering.lastPositionUploadBytes;
  }

  /** 最近一次共享同步提交的位置流上传调用数。 */
  public get lastPositionUploadCalls(): number {
    return this.rendering.lastPositionUploadCalls;
  }

  /** 当前共享 GPU 批次已经分配的实体容量。 */
  public get renderCapacity(): number {
    return this.rendering.renderCapacity;
  }

  /** 创建一个保留独立战斗状态、但登记到共享渲染批次的群体。 */
  public createCurveCrawler(
    options: Readonly<CurveCrawlerBatchPopulationOptions>,
  ): CurveCrawlerPopulation {
    this.ensureActive();
    return new CurveCrawlerPopulation(
      Object.freeze({
        ...options,
        surfaceMaterialTemplate: this.surfaceMaterialTemplate,
      }),
      CurveCrawlerMotionProfile.Autonomous,
      (state) => this.rendering.register(state),
    );
  }

  /** 在全部独立群体完成模拟后一次性提交组合顶点流。 */
  public synchronize(deltaTime: number): void {
    this.ensureActive();
    this.rendering.synchronize(deltaTime);
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.rendering.dispose();
  }

  private ensureActive(): void {
    if (this.disposed) {
      throw new Error('Curve Crawler 群体批次已经释放。');
    }
  }
}
