import { type Camera, type Material, Node } from 'cc';
import {
  isMonsterLifecycleResident,
  MonsterLifecycleState,
} from '../../../../../core/contracts/monster-lifecycle';
import {
  createUnlitColorGeometry,
  GeometryIndexFormat,
  type UnlitColorBufferGeometry,
} from '../../../../../core/geometry/buffer-geometry';
import { MeshDirty } from '../../../../../core/mesh/mesh-dirty';
import { DynamicMeshBatch } from '../../../../../core/rendering/dynamic-mesh-batch';
import { VENOM_LOBBER_MODEL_GEOMETRY } from '../geometry/venom-lobber-model-geometry';
import { VenomLobberAction } from '../model/venom-lobber-action';
import { type VenomLobberCombatOptions } from '../model/venom-lobber-combat-options';
import {
  VENOM_LOBBER_DEATH_SECONDS,
  VENOM_LOBBER_DESPAWN_SECONDS,
  VENOM_LOBBER_SPAWN_SECONDS,
} from '../model/venom-lobber-lifecycle';
import { type VenomLobberState } from '../model/venom-lobber-state';
import { VENOM_LOBBER_TAIL_PIVOT_FORWARD } from '../model/venom-lobber-tail-socket';
import { VenomLobberVisibilityLayout } from './venom-lobber-visibility-layout';

const BODY_OPTIONS = Object.freeze({ castShadows: false, receiveShadows: false });
const BODY_BOUNDS = Object.freeze({
  minX: -1_000_000,
  minY: -1_000_000,
  minZ: -32,
  maxX: 1_000_000,
  maxY: 1_000_000,
  maxZ: 512,
});
const LEG_GROUP_COUNT = 6;

/** 把全部可见 Venom Lobber 紧凑写入一个动态 MeshRenderer。 */
export class VenomLobberBodyRenderer {
  private readonly geometry: UnlitColorBufferGeometry;
  private readonly batch = new DynamicMeshBatch();
  private readonly tailCosines = new Float32Array(
    VENOM_LOBBER_MODEL_GEOMETRY.tailBoneCount,
  );
  private readonly tailSines = new Float32Array(
    VENOM_LOBBER_MODEL_GEOMETRY.tailBoneCount,
  );
  private readonly legCosines = new Float32Array(LEG_GROUP_COUNT);
  private readonly legSines = new Float32Array(LEG_GROUP_COUNT);
  private readonly packedEntityIds: Int32Array;
  private readonly previousHitFlash: Float32Array;
  private readonly previousSacPulse: Float32Array;
  private readonly visibility: VenomLobberVisibilityLayout;
  private frameColorDirty = false;
  private residentCount = 0;
  private disposed = false;

  constructor(
    private readonly parent: Node,
    private readonly state: VenomLobberState,
    private readonly combatOptions: Readonly<VenomLobberCombatOptions>,
    material: Material,
    private readonly camera: Camera,
  ) {
    this.packedEntityIds = new Int32Array(state.count);
    this.packedEntityIds.fill(-1);
    this.previousHitFlash = new Float32Array(state.count);
    this.previousSacPulse = new Float32Array(state.count);
    this.visibility = new VenomLobberVisibilityLayout(state.count);
    this.geometry = createBodyGeometry(state.count);
    try {
      this.batch.initialize(
        parent,
        'VenomLobberBodyBatch',
        this.geometry,
        material,
        BODY_BOUNDS,
        BODY_OPTIONS,
      );
      this.batch.setActiveIndexCount(0);
      this.batch.setVisible(false);
    } catch (error: unknown) {
      this.batch.dispose();
      throw error;
    }
  }

  public get activeEntityCount(): number {
    return this.residentCount;
  }

  public isVisible(entityIndex: number): boolean {
    return this.visibility.entities.has(entityIndex);
  }

  /** 原地紧凑重写全部具有可渲染生命周期的实体。 */
  public update(): void {
    if (this.disposed) {
      return;
    }
    const residentCount = this.writeGeometry();
    if (residentCount > 0) {
      const activeVertexCount = residentCount
        * VENOM_LOBBER_MODEL_GEOMETRY.geometry.vertexCount;
      const dirty = this.frameColorDirty
        ? MeshDirty.Position | MeshDirty.Color
        : MeshDirty.Position;
      this.batch.uploadVertexAttributes(dirty, activeVertexCount);
    }
    this.batch.setActiveIndexCount(
      residentCount * VENOM_LOBBER_MODEL_GEOMETRY.geometry.indexCount,
    );
    this.batch.setVisible(residentCount > 0);
    this.residentCount = residentCount;
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.batch.dispose();
  }

  private writeGeometry(): number {
    const renderCamera = this.camera.camera;
    renderCamera.update(true);
    const worldScale = this.parent.worldScale;
    this.visibility.synchronize(
      this.state,
      this.parent.worldMatrix,
      Math.max(Math.abs(worldScale.x), Math.abs(worldScale.y), Math.abs(worldScale.z)),
      renderCamera.frustum,
    );
    this.frameColorDirty = false;
    let packedIndex = 0;
    const { vitality, animation } = this.state.data;
    for (let entityIndex = 0; entityIndex < this.state.count; entityIndex++) {
      const lifecycle = vitality.state[entityIndex] as MonsterLifecycleState;
      if (!isMonsterLifecycleResident(lifecycle)) {
        continue;
      }
      if (!this.visibility.entities.has(entityIndex)) {
        continue;
      }
      const hitFlash = animation.hitFlash[entityIndex] ?? 0;
      const sacPulse = animation.sacPulse[entityIndex] ?? 0;
      const colorChanged = (this.packedEntityIds[packedIndex] ?? -1) !== entityIndex
        || (this.previousHitFlash[entityIndex] ?? 0) !== hitFlash
        || (this.previousSacPulse[entityIndex] ?? 0) !== sacPulse;
      this.writeEntity(entityIndex, packedIndex, lifecycle, colorChanged);
      this.packedEntityIds[packedIndex] = entityIndex;
      this.previousHitFlash[entityIndex] = hitFlash;
      this.previousSacPulse[entityIndex] = sacPulse;
      this.frameColorDirty ||= colorChanged;
      packedIndex++;
    }
    return packedIndex;
  }

  /**
   * 应用钻地展开、六足步态、卷尾蓄力、近战扑击和死亡侧翻。
   *
   * 尾节和足组的三角函数按实体预计算，顶点热循环只执行数组读取与乘加。
   */
  private writeEntity(
    entityIndex: number,
    packedIndex: number,
    lifecycle: MonsterLifecycleState,
    writeColors: boolean,
  ): void {
    const model = VENOM_LOBBER_MODEL_GEOMETRY;
    const source = model.geometry;
    const data = this.state.data;
    const { identity, transform, morphology, vitality } = data;
    const { behavior, combat, motion, animation } = data;
    const scale = morphology.scale[entityIndex] ?? 1;
    const stateTime = vitality.stateTime[entityIndex] ?? 0;
    const spawnProgress = lifecycle === MonsterLifecycleState.Spawning
      ? clamp01(stateTime / VENOM_LOBBER_SPAWN_SECONDS)
      : 1;
    const deathProgress = lifecycle === MonsterLifecycleState.Dying
      ? smoothStep(clamp01(stateTime / VENOM_LOBBER_DEATH_SECONDS))
      : 0;
    const despawnProgress = lifecycle === MonsterLifecycleState.Despawning
      ? smoothStep(clamp01(stateTime / VENOM_LOBBER_DESPAWN_SECONDS))
      : 0;
    const spawnEase = smoothStep(spawnProgress);
    const animationDirection = ((identity.appearanceSeed[entityIndex] ?? 0) & 1) === 0
      ? 1
      : -1;
    const action = behavior.action[entityIndex] as VenomLobberAction;
    const meleeStrike = getMeleeStrike(
      action,
      behavior.actionTime[entityIndex] ?? 0,
      combat.meleeTime[entityIndex] ?? 0,
      this.combatOptions,
    );
    const gaitPhase = animation.gaitPhase[entityIndex] ?? 0;
    const speedRatio = Math.min(
      1,
      Math.abs(motion.currentSpeed[entityIndex] ?? 0)
        / Math.max(morphology.cruiseSpeed[entityIndex] ?? 1, 0.01),
    );
    const tailAngle = Math.sin(gaitPhase * 0.72) * 0.14
      + (animation.tailCharge[entityIndex] ?? 0) * 0.82
      + animationDirection * Math.sin(deathProgress * Math.PI) * 0.92
      - animationDirection * deathProgress * 0.34;
    this.prepareTailRotations(tailAngle);
    this.prepareLegRotations(gaitPhase);

    const spawnTilt = (1 - spawnEase) * -0.64;
    const spawnTwist = Math.sin(spawnProgress * Math.PI) * animationDirection * 0.22;
    const deathLean = smoothStep(clamp01((stateTime - 0.18) / 0.5));
    const deathRoll = animationDirection * deathLean * 0.610865238;
    const spawnTiltCosine = Math.cos(spawnTilt);
    const spawnTiltSine = Math.sin(spawnTilt);
    const spawnTwistCosine = Math.cos(spawnTwist);
    const spawnTwistSine = Math.sin(spawnTwist);
    const deathRollCosine = Math.cos(deathRoll);
    const deathRollSine = Math.sin(deathRoll);
    const heading = transform.heading[entityIndex] ?? 0;
    const headingCosine = Math.cos(heading);
    const headingSine = Math.sin(heading);
    const rootX = transform.x[entityIndex] ?? 0;
    const rootY = transform.y[entityIndex] ?? 0;
    const bodyBob = (animation.bodyBob[entityIndex] ?? 0) - meleeStrike * 0.16;
    const spawnLift = (spawnEase - 1) * 8.6;
    const deathSink = -smoothStep(clamp01((stateTime - 1.08) / 0.77)) * 1.8
      - despawnProgress * 2.4;
    const hitFlash = animation.hitFlash[entityIndex] ?? 0;
    const venomPulse = animation.sacPulse[entityIndex] ?? 0;
    const targetVertexBase = packedIndex * source.vertexCount;

    for (let vertex = 0; vertex < source.vertexCount; vertex++) {
      const sourcePositionOffset = vertex * 3;
      let localX = source.positions[sourcePositionOffset] ?? 0;
      let localY = source.positions[sourcePositionOffset + 1] ?? 0;
      let localZ = source.positions[sourcePositionOffset + 2] ?? 0;

      const tailBone = model.tailBones[vertex] ?? 0;
      if (tailBone > 0) {
        const relativeX = localX - VENOM_LOBBER_TAIL_PIVOT_FORWARD;
        const cosine = this.tailCosines[tailBone] ?? 1;
        const sine = this.tailSines[tailBone] ?? 0;
        localX = VENOM_LOBBER_TAIL_PIVOT_FORWARD
          + relativeX * cosine
          - localY * sine;
        localY = relativeX * sine + localY * cosine;
      }

      const legGroup = model.legGroups[vertex] ?? 0;
      if (legGroup > 0) {
        const groupIndex = legGroup - 1;
        const longitudinalGroup = groupIndex % 3;
        const spawnLeg = smoothStep(clamp01(
          (stateTime - (0.32 + (2 - longitudinalGroup) * 0.08)) / 0.34,
        ));
        const deathLeg = smoothStep(clamp01(
          (stateTime - (0.18 + (2 - longitudinalGroup) * 0.08)) / 0.34,
        ));
        const lifecycleSpread = lifecycle === MonsterLifecycleState.Spawning
          ? 0.14 + spawnLeg * 0.86
          : 1 - deathLeg * 0.7 - despawnProgress * 0.72;
        localY *= Math.max(0.12, lifecycleSpread);
        localX += (this.legCosines[groupIndex] ?? 0) * speedRatio * 0.18;
        localZ += Math.max(0, this.legSines[groupIndex] ?? 0) * speedRatio * 0.28;
      }

      const strikeWeight = model.strikeWeights[vertex] ?? 0;
      if (strikeWeight > 0 && meleeStrike > 0) {
        localX += strikeWeight * meleeStrike * 1.38;
        localY *= 1 - strikeWeight * meleeStrike * 0.08;
        localZ -= strikeWeight * meleeStrike * 0.48;
      }

      const venomWeight = model.venomWeights[vertex] ?? 0;
      const implosion = smoothStep(clamp01((stateTime - 0.68) / 0.4));
      if (lifecycle === MonsterLifecycleState.Dying && venomWeight > 0) {
        localY *= 1 - venomWeight * implosion * 0.42;
        localZ *= 1 - venomWeight * implosion * 0.34;
      }

      const tiltedX = localX * spawnTiltCosine - localZ * spawnTiltSine;
      let posedZ = localX * spawnTiltSine + localZ * spawnTiltCosine;
      const twistedX = tiltedX * spawnTwistCosine - localY * spawnTwistSine;
      let posedY = tiltedX * spawnTwistSine + localY * spawnTwistCosine;
      const rolledY = posedY * deathRollCosine - posedZ * deathRollSine;
      posedZ = posedY * deathRollSine + posedZ * deathRollCosine;
      posedY = rolledY;

      const scaledX = twistedX * scale;
      const scaledY = posedY * scale;
      const worldX = rootX + scaledX * headingCosine - scaledY * headingSine;
      const worldY = rootY + scaledX * headingSine + scaledY * headingCosine;
      const tailLead = tailBone > 0
        ? tailBone / Math.max(1, model.tailBoneCount - 1)
        : 0;
      const vertexSpawnLift = spawnLift * (1 - tailLead * 0.76);
      let worldZ = (posedZ + bodyBob + vertexSpawnLift + deathSink) * scale;
      if (lifecycle !== MonsterLifecycleState.Spawning) {
        worldZ = Math.max(0.025, worldZ);
      }
      const targetVertex = targetVertexBase + vertex;
      const targetPositionOffset = targetVertex * 3;
      this.geometry.positions[targetPositionOffset] = worldX;
      this.geometry.positions[targetPositionOffset + 1] = worldY;
      this.geometry.positions[targetPositionOffset + 2] = worldZ;

      if (writeColors) {
        const sourceColorOffset = vertex * 4;
        const targetColorOffset = targetVertex * 4;
        const pulse = 1 + venomWeight * venomPulse * 0.42;
        const red = (source.colors[sourceColorOffset] ?? 0) * pulse;
        const green = (source.colors[sourceColorOffset + 1] ?? 0) * pulse;
        const blue = (source.colors[sourceColorOffset + 2] ?? 0) * pulse;
        this.geometry.colors[targetColorOffset] = Math.min(1, red + hitFlash * 0.72);
        this.geometry.colors[targetColorOffset + 1] = Math.min(1, green + hitFlash * 0.24);
        this.geometry.colors[targetColorOffset + 2] = Math.min(1, blue + hitFlash * 0.16);
        this.geometry.colors[targetColorOffset + 3] = 1;
      }
    }
  }

  private prepareTailRotations(tailAngle: number): void {
    const denominator = Math.max(1, this.tailCosines.length - 1);
    for (let bone = 0; bone < this.tailCosines.length; bone++) {
      const angle = tailAngle * bone / denominator;
      this.tailCosines[bone] = Math.cos(angle);
      this.tailSines[bone] = Math.sin(angle);
    }
  }

  private prepareLegRotations(gaitPhase: number): void {
    for (let group = 0; group < LEG_GROUP_COUNT; group++) {
      const longitudinalGroup = group % 3;
      const sideOffset = group >= 3 ? Math.PI : 0;
      const angle = gaitPhase + longitudinalGroup * Math.PI * 2 / 3 + sideOffset;
      this.legCosines[group] = Math.cos(angle);
      this.legSines[group] = Math.sin(angle);
    }
  }
}

function createBodyGeometry(capacity: number): UnlitColorBufferGeometry {
  const source = VENOM_LOBBER_MODEL_GEOMETRY.geometry;
  const geometry = createUnlitColorGeometry(
    source.vertexCount * capacity,
    source.indexCount * capacity,
    GeometryIndexFormat.Uint32,
  );
  const sourceIndices = source.getIndexView();
  for (let entity = 0; entity < capacity; entity++) {
    const vertexOffset = entity * source.vertexCount;
    const indexOffset = entity * source.indexCount;
    for (let index = 0; index < sourceIndices.length; index++) {
      geometry.index[indexOffset + index] = (sourceIndices[index] ?? 0) + vertexOffset;
    }
  }
  geometry.commitCounts(geometry.maxVertices, geometry.maxIndices);
  return geometry;
}

function getMeleeStrike(
  action: VenomLobberAction,
  actionTime: number,
  meleeTime: number,
  options: Readonly<VenomLobberCombatOptions>,
): number {
  if (action === VenomLobberAction.MeleeWindup) {
    const progress = clamp01(meleeTime / options.meleeWindupSeconds);
    if (progress <= 0.62) {
      return smoothStep(progress / 0.62);
    }
    return 1 - (progress - 0.62) / 0.38 * 0.22;
  }
  if (action === VenomLobberAction.MeleeRecover) {
    return clamp01(actionTime / options.meleeRecoverySeconds) * 0.78;
  }
  return 0;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(value, 1));
}

function smoothStep(value: number): number {
  return value * value * (3 - value * 2);
}
