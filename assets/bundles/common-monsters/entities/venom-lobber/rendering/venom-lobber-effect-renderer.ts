import { type Material, Node } from 'cc';
import {
  type UnlitColorBufferGeometry,
} from '../../../../../core/geometry/buffer-geometry';
import { MonsterLifecycleState } from '../../../../../core/contracts/monster-lifecycle';
import { MeshDirty } from '../../../../../core/mesh/mesh-dirty';
import { DynamicMeshBatch } from '../../../../../core/rendering/dynamic-mesh-batch';
import {
  createVenomEffectGeometry,
  appendVenomEffectTopologyIndices,
  VenomEffectTopology,
  VENOM_EFFECT_SLOT_VERTEX_COUNT,
  writeVenomChargeEffectSlot,
  writeVenomBombEffectSlot,
  writeVenomPoolEffectSlot,
} from '../geometry/venom-lobber-effect-geometry';
import { type VenomBombSystem } from '../behavior/venom-bomb-system';
import { VenomLobberAction } from '../model/venom-lobber-action';
import { type VenomLobberCombatOptions } from '../model/venom-lobber-combat-options';
import { type VenomLobberState } from '../model/venom-lobber-state';
import {
  type MutableVenomLobberTailSocket,
  writeVenomLobberTailSocket,
} from '../model/venom-lobber-tail-socket';

const EFFECT_OPTIONS = Object.freeze({ castShadows: false, receiveShadows: false });
const EFFECT_BOUNDS = Object.freeze({
  minX: -1_000_000,
  minY: -1_000_000,
  minZ: -32,
  maxX: 1_000_000,
  maxY: 1_000_000,
  maxZ: 512,
});

/** 把全部毒弹、落点预警和酸池压入单一动态效果批次。 */
export class VenomLobberEffectRenderer {
  private readonly geometry: UnlitColorBufferGeometry<Uint32Array>;
  private readonly batch = new DynamicMeshBatch();
  private readonly tailSocket: MutableVenomLobberTailSocket = { x: 0, y: 0 };
  private readonly packedEffectKeys: Int32Array;
  private readonly packedTopologies: Uint8Array;
  private previousPackedSlotCount = 0;
  private activeIndexCount = 0;
  private disposed = false;

  constructor(
    parent: Node,
    private readonly state: VenomLobberState,
    private readonly effects: VenomBombSystem,
    private readonly combat: Readonly<VenomLobberCombatOptions>,
    material: Material,
  ) {
    const slotCapacity = state.count + effects.bombs.capacity + effects.pools.capacity;
    this.geometry = createVenomEffectGeometry(slotCapacity);
    this.packedEffectKeys = new Int32Array(slotCapacity);
    this.packedEffectKeys.fill(-1);
    this.packedTopologies = new Uint8Array(slotCapacity);
    try {
      this.batch.initialize(
        parent,
        'VenomLobberEffectsBatch',
        this.geometry,
        material,
        EFFECT_BOUNDS,
        EFFECT_OPTIONS,
      );
      this.batch.setActiveIndexCount(0);
      this.batch.setVisible(false);
    } catch (error: unknown) {
      this.batch.dispose();
      throw error;
    }
  }

  /** 紧凑写入当前活动效果，休眠槽位不参与顶点上传和三角形提交。 */
  public update(): void {
    if (this.disposed) {
      return;
    }
    let packedSlot = 0;
    let colorDirty = false;
    let topologyDirty = false;
    const { transform, morphology, vitality, behavior, combat, animation } = this.state.data;
    for (let index = 0; index < this.state.count; index++) {
      if ((vitality.state[index] as MonsterLifecycleState) !== MonsterLifecycleState.Alive
        || (behavior.action[index] as VenomLobberAction) !== VenomLobberAction.Cast
        || (combat.projectileReleased[index] ?? 0) !== 0) {
        continue;
      }
      const scale = morphology.scale[index] ?? 1;
      writeVenomLobberTailSocket(
        this.tailSocket,
        transform.x[index] ?? 0,
        transform.y[index] ?? 0,
        transform.heading[index] ?? 0,
        scale,
        animation.tailCharge[index] ?? 0,
      );
      writeVenomChargeEffectSlot(
        this.geometry,
        packedSlot,
        this.tailSocket.x,
        this.tailSocket.y,
        this.combat.projectileStartElevation * scale,
        animation.tailCharge[index] ?? 0,
        animation.gaitPhase[index] ?? 0,
      );
      if (this.capturePackedEffectKey(packedSlot, index)) {
        colorDirty = true;
      }
      topologyDirty = this.capturePackedTopology(
        packedSlot,
        VenomEffectTopology.Charge,
      ) || topologyDirty;
      packedSlot++;
    }
    const bombs = this.effects.bombs;
    for (let index = 0; index < bombs.capacity; index++) {
      if ((bombs.active[index] ?? 0) === 0) {
        continue;
      }
      writeVenomBombEffectSlot(
        this.geometry,
        packedSlot,
        bombs,
        index,
        this.combat.blastRadius,
      );
      if (this.capturePackedEffectKey(packedSlot, 0x10000 + index)) {
        colorDirty = true;
      }
      topologyDirty = this.capturePackedTopology(
        packedSlot,
        VenomEffectTopology.Projectile,
      ) || topologyDirty;
      packedSlot++;
    }
    const pools = this.effects.pools;
    for (let index = 0; index < pools.capacity; index++) {
      if ((pools.active[index] ?? 0) === 0) {
        continue;
      }
      writeVenomPoolEffectSlot(this.geometry, packedSlot, pools, index);
      const poolKey = 0x20000 + index + ((pools.catalyzed[index] ?? 0) << 20);
      if (this.capturePackedEffectKey(packedSlot, poolKey)) {
        colorDirty = true;
      }
      topologyDirty = this.capturePackedTopology(
        packedSlot,
        VenomEffectTopology.Pool,
      ) || topologyDirty;
      packedSlot++;
    }
    if (packedSlot > 0) {
      const vertexCount = packedSlot * VENOM_EFFECT_SLOT_VERTEX_COUNT;
      const dirty = colorDirty
        ? MeshDirty.Position | MeshDirty.Color
        : MeshDirty.Position;
      this.batch.uploadVertexAttributes(dirty, vertexCount);
    }
    if (packedSlot !== this.previousPackedSlotCount) {
      topologyDirty = true;
      this.previousPackedSlotCount = packedSlot;
    }
    if (topologyDirty) {
      let indexCount = 0;
      for (let slot = 0; slot < packedSlot; slot++) {
        indexCount = appendVenomEffectTopologyIndices(
          this.geometry.index,
          indexCount,
          slot,
          this.packedTopologies[slot] as VenomEffectTopology,
        );
      }
      this.activeIndexCount = indexCount;
      this.batch.uploadIndices(indexCount);
    } else {
      this.batch.setActiveIndexCount(this.activeIndexCount);
    }
    this.batch.setVisible(packedSlot > 0);
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.batch.dispose();
  }

  private capturePackedEffectKey(slot: number, key: number): boolean {
    const changed = (this.packedEffectKeys[slot] ?? -1) !== key;
    this.packedEffectKeys[slot] = key;
    return changed;
  }

  private capturePackedTopology(slot: number, topology: VenomEffectTopology): boolean {
    const changed = (this.packedTopologies[slot] ?? 0) !== topology;
    this.packedTopologies[slot] = topology;
    return changed;
  }
}
