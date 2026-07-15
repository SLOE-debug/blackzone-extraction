import {
  _decorator,
  Camera,
  Color,
  Component,
  director,
  error,
  Node,
  Vec3,
} from 'cc';
import { BundleService } from '../core/bundles/bundle-service';
import { FeatureId } from '../core/contracts/runtime-id';
import { FeatureLoader } from '../core/features/feature-loader';
import { featureRegistry } from '../core/features/feature-registry';

const { ccclass, property } = _decorator;
const CAMERA_TARGET = new Vec3(0, 0, 0);
const CAMERA_UP = new Vec3(0, 0, 1);

interface DemoPopulation {
  update(deltaTime: number): void;
  dispose(): void;
}

/**
 * Common Monsters 的最小测试入口，只负责加载 Bundle、创建群体和配置相机。
 */
@ccclass('CommonMonstersDemo')
export class CommonMonstersDemo extends Component {
  @property({ min: 1, max: 500, step: 1, tooltip: '测试场景中的 Curve Crawler 数量。' })
  public count = 180;

  @property({ min: 1, max: 169, step: 1, tooltip: '每个动态网格批次容纳的实体数量。' })
  public batchSize = 96;

  @property({ min: 80, max: 1000, step: 10, tooltip: '怪物活动区域宽度。' })
  public arenaWidth = 320;

  @property({ min: 60, max: 600, step: 10, tooltip: '怪物活动区域高度。' })
  public arenaHeight = 180;

  @property({ tooltip: '用于复现相同群体行为的随机种子。' })
  public seed = 20260715;

  private readonly featureLoader = new FeatureLoader(new BundleService(), featureRegistry);
  private population: DemoPopulation | null = null;
  private destroyed = false;

  protected onLoad(): void {
    this.configureCamera();
  }

  protected start(): void {
    void this.initializePopulation();
  }

  protected update(deltaTime: number): void {
    this.population?.update(deltaTime);
  }

  protected onDestroy(): void {
    this.destroyed = true;
    this.population?.dispose();
    this.population = null;
  }

  private async initializePopulation(): Promise<void> {
    try {
      const feature = await this.featureLoader.load(FeatureId.CommonMonsters);
      if (this.destroyed || !this.node.isValid) {
        return;
      }

      this.population = feature.createCurveCrawler(this.node, {
        count: this.count,
        batchSize: this.batchSize,
        arena: {
          width: this.arenaWidth,
          height: this.arenaHeight,
        },
        seed: this.seed,
      });
    } catch (cause: unknown) {
      error('Common Monsters Demo 初始化失败。', cause);
    }
  }

  private configureCamera(): void {
    const scene = director.getScene();
    if (scene === null) {
      throw new Error('Common Monsters Demo 启动时没有活动场景。');
    }

    let camera = scene.getComponentInChildren(Camera);
    if (camera === null) {
      const cameraNode = new Node('Main Camera');
      scene.addChild(cameraNode);
      camera = cameraNode.addComponent(Camera);
    }

    const cameraDistance = Math.max(this.arenaWidth, this.arenaHeight) * 1.25;
    camera.node.setPosition(0, -cameraDistance, cameraDistance);
    camera.node.lookAt(CAMERA_TARGET, CAMERA_UP);
    camera.projection = Camera.ProjectionType.PERSPECTIVE;
    camera.fovAxis = Camera.FOVAxis.VERTICAL;
    camera.fov = 45;
    camera.near = 1;
    camera.far = cameraDistance * 4;
    camera.clearFlags = Camera.ClearFlag.SOLID_COLOR;
    camera.clearColor = new Color(248, 246, 240, 255);
  }
}
