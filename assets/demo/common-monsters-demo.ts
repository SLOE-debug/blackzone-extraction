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
import { OrbitCameraController } from './orbit-camera-controller';

const { ccclass, property } = _decorator;
const CAMERA_TARGET = new Vec3(0, 0, 0);

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

  @property({ min: 80, max: 1000, step: 10, tooltip: '怪物初始生成区域宽度。' })
  public spawnWidth = 320;

  @property({ min: 60, max: 600, step: 10, tooltip: '怪物初始生成区域高度。' })
  public spawnHeight = 180;

  @property({ tooltip: '用于复现相同群体行为的随机种子。' })
  public seed = 20260715;

  private readonly featureLoader = new FeatureLoader(new BundleService(), featureRegistry);
  private population: DemoPopulation | null = null;
  private orbitCamera: OrbitCameraController | null = null;
  private destroyed = false;

  protected onLoad(): void {
    this.configureCamera();
  }

  protected start(): void {
    void this.initializePopulation();
  }

  protected update(deltaTime: number): void {
    this.orbitCamera?.update(deltaTime);
    this.population?.update(deltaTime);
  }

  protected onDestroy(): void {
    this.destroyed = true;
    this.orbitCamera?.dispose();
    this.orbitCamera = null;
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
        spawnArea: {
          width: this.spawnWidth,
          height: this.spawnHeight,
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

    const maximumSceneSize = Math.max(this.spawnWidth, this.spawnHeight);
    const cameraDistance = maximumSceneSize * 1.75;
    camera.projection = Camera.ProjectionType.PERSPECTIVE;
    camera.fovAxis = Camera.FOVAxis.VERTICAL;
    camera.fov = 45;
    camera.near = 0.5;
    camera.far = maximumSceneSize * 12;
    camera.clearFlags = Camera.ClearFlag.SOLID_COLOR;
    camera.clearColor = new Color(248, 246, 240, 255);

    this.orbitCamera?.dispose();
    this.orbitCamera = new OrbitCameraController(camera, {
      target: CAMERA_TARGET,
      distance: cameraDistance,
      minimumDistance: maximumSceneSize * 0.08,
      maximumDistance: maximumSceneSize * 6,
      azimuthAngle: -Math.PI * 0.5,
      polarAngle: Math.PI * 0.25,
      minimumPolarAngle: 0.08,
      maximumPolarAngle: Math.PI * 0.5 - 0.02,
      rotateSpeed: 0.005,
      zoomSpeed: 0.0015,
      dollyDragSpeed: 0.012,
      panSpeed: 1,
      dampingFactor: 0.12,
    });
  }
}
