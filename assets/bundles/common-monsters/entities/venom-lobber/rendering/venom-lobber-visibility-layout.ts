import { geometry, type Mat4, Vec3 } from 'cc';
import {
  isMonsterLifecycleResident,
  type MonsterLifecycleState,
} from '../../../../../core/contracts/monster-lifecycle';
import { EntityVisibilitySet } from '../../../../../core/rendering/dynamic-entities/entity-visibility-set';
import { type VenomLobberState } from '../model/venom-lobber-state';

const LOCAL_CENTER_HEIGHT = 3.2;
const LOCAL_RADIUS = 8.5;

/** 维护 Venom Lobber 逐实体相机视锥可见集合。 */
export class VenomLobberVisibilityLayout {
  public readonly entities: EntityVisibilitySet;
  private readonly localCenter = new Vec3();
  private readonly worldCenter = new Vec3();
  private readonly sphere = new geometry.Sphere();

  constructor(capacity: number) {
    this.entities = new EntityVisibilitySet(capacity);
  }

  public synchronize(
    state: VenomLobberState,
    worldMatrix: Readonly<Mat4>,
    maximumWorldScale: number,
    frustum: geometry.Frustum,
  ): void {
    this.entities.begin();
    const { transform, morphology, vitality } = state.data;
    for (let index = 0; index < state.count; index++) {
      if (!isMonsterLifecycleResident(vitality.state[index] as MonsterLifecycleState)) {
        continue;
      }
      this.localCenter.set(
        transform.x[index] ?? 0,
        transform.y[index] ?? 0,
        LOCAL_CENTER_HEIGHT * (morphology.scale[index] ?? 1),
      );
      Vec3.transformMat4(this.worldCenter, this.localCenter, worldMatrix);
      geometry.Sphere.set(
        this.sphere,
        this.worldCenter.x,
        this.worldCenter.y,
        this.worldCenter.z,
        LOCAL_RADIUS * (morphology.scale[index] ?? 1) * maximumWorldScale,
      );
      if (geometry.intersect.sphereFrustum(this.sphere, frustum) !== 0) {
        this.entities.include(index);
      }
    }
    this.entities.end();
  }
}
