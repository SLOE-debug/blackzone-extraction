import { Color, type Material, Node, SphereLight } from 'cc';
import { type UnlitColorBufferGeometry } from '../../../../core/geometry/buffer-geometry';
import { MeshDirty } from '../../../../core/mesh/mesh-dirty';
import { DynamicMeshBatch } from '../../../../core/rendering/dynamic-mesh-batch';
import {
  evaluateTreasureChestAttention,
  TREASURE_CHEST_ATTENTION,
  type MutableTreasureChestAttentionSample,
} from '../animation/treasure-chest-attention';
import {
  createTreasureChestBeaconGeometry,
  writeTreasureChestBeaconGeometry,
} from '../geometry/treasure-chest-beacon-geometry';
import { TREASURE_CHEST_BEACON_LAYOUT } from '../model/treasure-chest-beacon-layout';
import { createTreasureChestBeaconMaterial } from './treasure-chest-beacon-material';

const BEACON_OPTIONS = Object.freeze({
  castShadows: false,
  receiveShadows: false,
});
const BEACON_BOUNDS = Object.freeze({
  minX: -TREASURE_CHEST_BEACON_LAYOUT.boundsRadius,
  minY: 0,
  minZ: -TREASURE_CHEST_BEACON_LAYOUT.boundsRadius,
  maxX: TREASURE_CHEST_BEACON_LAYOUT.boundsRadius,
  maxY: TREASURE_CHEST_BEACON_LAYOUT.boundsHeight,
  maxZ: TREASURE_CHEST_BEACON_LAYOUT.boundsRadius,
});

/** 渲染宝箱脚下信标，并用真实球面光在周围地形上形成暖色辉光。 */
export class TreasureChestBeaconRenderer {
  private readonly geometry: UnlitColorBufferGeometry;
  private readonly material: Material;
  private readonly batch = new DynamicMeshBatch();
  private readonly lightNode: Node;
  private readonly light: SphereLight;
  private readonly sample: MutableTreasureChestAttentionSample = {
    signalStrength: 0,
    proximity: 0,
    pulse: 0,
  };
  private lastSampleIndex = -1;
  private attentionActive = true;
  private disposed = false;

  constructor(parent: Node) {
    this.geometry = createTreasureChestBeaconGeometry();
    this.material = createTreasureChestBeaconMaterial();
    const lightNode = new Node('TreasureChestGlowLight');
    try {
      parent.addChild(lightNode);
      lightNode.setPosition(0, TREASURE_CHEST_BEACON_LAYOUT.lightHeight, 0);
      const light = lightNode.addComponent(SphereLight);
      light.color = new Color(255, 142, 42, 255);
      light.size = TREASURE_CHEST_BEACON_LAYOUT.lightSize;
      light.range = TREASURE_CHEST_BEACON_LAYOUT.lightRange;
      evaluateTreasureChestAttention(
        0,
        TREASURE_CHEST_ATTENTION.awarenessRadius
          * TREASURE_CHEST_ATTENTION.awarenessRadius,
        true,
        this.sample,
      );
      writeTreasureChestBeaconGeometry(this.geometry, 0, this.sample.signalStrength);
      light.luminousFlux = evaluateLightFlux(this.sample.signalStrength);
      this.batch.initialize(
        parent,
        'TreasureChestBeaconBatch',
        this.geometry,
        this.material,
        BEACON_BOUNDS,
        BEACON_OPTIONS,
      );
      this.lightNode = lightNode;
      this.light = light;
      this.lastSampleIndex = 0;
    } catch (error: unknown) {
      this.batch.dispose();
      this.material.destroy();
      if (lightNode.isValid) {
        lightNode.destroy();
      }
      throw error;
    }
  }

  /** 以固定频率同步信标顶点流和真实灯光，开启状态变化时立即生效。 */
  public update(
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
    const sampleIndex = Math.floor(elapsed * TREASURE_CHEST_ATTENTION.samplesPerSecond);
    if (sampleIndex === this.lastSampleIndex && active === this.attentionActive) {
      return;
    }
    this.lastSampleIndex = sampleIndex;
    this.attentionActive = active;
    const sampledTime = sampleIndex / TREASURE_CHEST_ATTENTION.samplesPerSecond;
    evaluateTreasureChestAttention(
      sampledTime,
      playerDistanceSquared,
      active,
      this.sample,
    );
    writeTreasureChestBeaconGeometry(
      this.geometry,
      sampledTime,
      this.sample.signalStrength,
    );
    this.batch.uploadVertexAttributes(MeshDirty.Position | MeshDirty.Color);
    this.batch.setVisible(active);
    this.light.enabled = active;
    if (active) {
      this.light.luminousFlux = evaluateLightFlux(this.sample.signalStrength);
    }
  }

  /** 释放信标批次、独占材质和灯光节点。 */
  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.batch.dispose();
    this.material.destroy();
    if (this.lightNode.isValid) {
      this.lightNode.destroy();
    }
  }
}

function evaluateLightFlux(signalStrength: number): number {
  const layout = TREASURE_CHEST_BEACON_LAYOUT;
  return layout.lightMinimumFlux
    + (layout.lightMaximumFlux - layout.lightMinimumFlux) * signalStrength;
}
