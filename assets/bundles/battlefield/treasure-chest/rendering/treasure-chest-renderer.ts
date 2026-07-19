import { Color, type Material, Node } from 'cc';
import { StandardVertexColorMaterialFactory } from '../../../../core/rendering/standard-vertex-color-material-factory';
import { StaticSurfaceMesh } from '../../../../core/rendering/static-surface-mesh';
import { TREASURE_CHEST_BODY_GEOMETRY } from '../geometry/treasure-chest-body-geometry';
import { TREASURE_CHEST_LID_GEOMETRY } from '../geometry/treasure-chest-lid-geometry';
import {
  evaluateTreasureChestAttention,
  TREASURE_CHEST_ATTENTION,
  type MutableTreasureChestAttentionColor,
} from '../animation/treasure-chest-attention';
import { TREASURE_CHEST_LAYOUT } from '../model/treasure-chest-layout';

const DEGREES_PER_RADIAN = 180 / Math.PI;
const CHEST_SURFACE_OPTIONS = Object.freeze({
  castShadows: true,
  receiveShadows: true,
  uploadLightingAttributes: true,
});

/** 创建宝箱节点、受光材质并只接受动画系统给出的箱盖角度。 */
export class TreasureChestRenderer {
  private readonly root: Node;
  private readonly lidPivot: Node;
  private readonly bodyMesh = new StaticSurfaceMesh();
  private readonly lidMesh = new StaticSurfaceMesh();
  private readonly material: Material;
  private readonly attentionColor = new Color(3, 1, 0, 255);
  private readonly attentionChannels: MutableTreasureChestAttentionColor = {
    red: 3,
    green: 1,
    blue: 0,
  };
  private lastAttentionSample = -1;
  private attentionActive = false;
  private appliedAttentionRed = 3;
  private appliedAttentionGreen = 1;
  private appliedAttentionBlue = 0;
  private disposed = false;

  constructor(
    parent: Node,
    surfaceMaterialTemplate: Material,
    x: number,
    y: number,
    z: number,
    heading: number,
  ) {
    const root = new Node('TreasureChest');
    parent.addChild(root);
    root.setPosition(x, y, z);
    root.setRotationFromEuler(0, heading * DEGREES_PER_RADIAN, 0);
    this.root = root;

    const lidPivot = new Node('TreasureChestLidPivot');
    root.addChild(lidPivot);
    lidPivot.setPosition(0, TREASURE_CHEST_LAYOUT.hingeY, TREASURE_CHEST_LAYOUT.hingeZ);
    this.lidPivot = lidPivot;

    let material: Material | null = null;
    try {
      material = StandardVertexColorMaterialFactory.create(surfaceMaterialTemplate, {
        name: 'TreasureChestSurfaceMaterial',
        mainColor: new Color(255, 255, 255, 255),
        roughness: 0.72,
        metallic: 0.14,
        specularIntensity: 0.4,
        emissive: new Color(3, 1, 0, 255),
      });
      this.material = material;
      this.bodyMesh.initialize(
        root,
        'TreasureChestBody',
        TREASURE_CHEST_BODY_GEOMETRY,
        material,
        CHEST_SURFACE_OPTIONS,
      );
      this.lidMesh.initialize(
        lidPivot,
        'TreasureChestLid',
        TREASURE_CHEST_LID_GEOMETRY,
        material,
        CHEST_SURFACE_OPTIONS,
      );
    } catch (error: unknown) {
      this.disposed = true;
      this.lidMesh.dispose();
      this.bodyMesh.dispose();
      material?.destroy();
      if (root.isValid) {
        root.destroy();
      }
      throw error;
    }
  }

  /** 应用动画系统求值后的绕本地 X 轴箱盖角度。 */
  public setLidAngleDegrees(angle: number): void {
    if (this.disposed || !Number.isFinite(angle)) {
      return;
    }
    this.lidPivot.setRotationFromEuler(angle, 0, 0);
  }

  /** 以固定 30Hz 采样更新已有材质 uniform，不创建额外灯光或渲染 Pass。 */
  public updateAttention(
    elapsed: number,
    playerDistanceSquared: number,
    active: boolean,
  ): void {
    if (this.disposed) {
      return;
    }
    if (!active && !this.attentionActive) {
      return;
    }
    const sample = Math.floor(elapsed * TREASURE_CHEST_ATTENTION.samplesPerSecond);
    if (sample === this.lastAttentionSample && active === this.attentionActive) {
      return;
    }
    this.lastAttentionSample = sample;
    this.attentionActive = active;
    const sampledTime = sample / TREASURE_CHEST_ATTENTION.samplesPerSecond;
    evaluateTreasureChestAttention(
      sampledTime,
      playerDistanceSquared,
      active,
      this.attentionChannels,
    );
    if (
      this.attentionChannels.red === this.appliedAttentionRed
      && this.attentionChannels.green === this.appliedAttentionGreen
      && this.attentionChannels.blue === this.appliedAttentionBlue
    ) {
      return;
    }
    this.appliedAttentionRed = this.attentionChannels.red;
    this.appliedAttentionGreen = this.attentionChannels.green;
    this.appliedAttentionBlue = this.attentionChannels.blue;
    this.attentionColor.set(
      this.attentionChannels.red,
      this.attentionChannels.green,
      this.attentionChannels.blue,
      255,
    );
    this.material.setProperty('emissive', this.attentionColor);
  }

  /** 按 Mesh、材质、根节点的所有权顺序释放宝箱渲染资源。 */
  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.lidMesh.dispose();
    this.bodyMesh.dispose();
    this.material.destroy();
    if (this.root.isValid) {
      this.root.destroy();
    }
  }
}
