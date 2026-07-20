import { type Node } from 'cc';
import {
  type WeaponEquipmentDefinition,
  type WeaponProjectileDefinition,
} from '../../../../../core/equipment/equipment';
import {
  type BattlefieldMonsterPopulation,
  type MutableBattlefieldProjectileHit,
} from '../../../population/battlefield-monster-population';
import {
  BattlefieldProjectileState,
  calculateProjectileCapacity,
} from '../model/battlefield-projectile-state';
import { BattlefieldProjectileRenderer } from '../rendering/battlefield-projectile-renderer';

const MAXIMUM_DELTA_TIME = 0.05;

/** 管理单件武器全部在途子弹的预分配状态、碰撞与批渲染。 */
export class BattlefieldProjectilePopulation {
  private readonly state: BattlefieldProjectileState;
  private readonly renderer: BattlefieldProjectileRenderer;
  private readonly projectile: Readonly<WeaponProjectileDefinition>;
  private readonly hitResult: MutableBattlefieldProjectileHit = {
    entityId: -1,
    x: 0,
    y: 0,
    z: 0,
    segmentProgress: 0,
  };
  private renderingDirty = false;
  private disposed = false;

  constructor(
    parent: Node,
    private readonly weapon: Readonly<WeaponEquipmentDefinition>,
  ) {
    this.projectile = weapon.projectile;
    this.state = new BattlefieldProjectileState(calculateProjectileCapacity(weapon));
    this.renderer = new BattlefieldProjectileRenderer(
      parent,
      this.state,
      this.projectile.visual,
    );
  }

  /** 在枪口位置复用一个子弹槽位。 */
  public spawn(
    x: number,
    y: number,
    z: number,
    directionX: number,
    directionY: number,
    directionZ: number,
  ): void {
    if (this.disposed) {
      return;
    }
    this.state.spawn(x, y, z, directionX, directionY, directionZ);
    this.renderingDirty = true;
  }

  /** 推进全部在途子弹，并把每段位移的首个命中路由给怪物群。 */
  public update(deltaTime: number, monsters: BattlefieldMonsterPopulation): void {
    if (this.disposed) {
      return;
    }
    if (!Number.isFinite(deltaTime)) {
      throw new Error('战场子弹帧时间必须是有限数值。');
    }
    const safeDeltaTime = Math.max(0, Math.min(deltaTime, MAXIMUM_DELTA_TIME));
    let changed = this.renderingDirty;
    const projectile = this.projectile;
    for (let slot = 0; slot < this.state.capacity; slot++) {
      if ((this.state.active[slot] ?? 0) === 0) {
        continue;
      }
      changed = true;
      const startX = this.state.x[slot] ?? 0;
      const startY = this.state.y[slot] ?? 0;
      const startZ = this.state.z[slot] ?? 0;
      const travelled = this.state.travelledDistance[slot] ?? 0;
      const remainingDistance = Math.max(0, projectile.maximumRange - travelled);
      if (remainingDistance <= 0) {
        this.state.deactivate(slot);
        continue;
      }
      const stepDistance = Math.min(projectile.speed * safeDeltaTime, remainingDistance);
      if (stepDistance <= 0) {
        continue;
      }
      const endX = startX + (this.state.directionX[slot] ?? 0) * stepDistance;
      const endY = startY + (this.state.directionY[slot] ?? 0) * stepDistance;
      const endZ = startZ + (this.state.directionZ[slot] ?? 1) * stepDistance;
      if (monsters.damageFirstAlongSegment(
        startX,
        startY,
        startZ,
        endX,
        endY,
        endZ,
        projectile.impactRadius,
        this.weapon.damage,
        this.hitResult,
      )) {
        this.state.deactivate(slot);
        continue;
      }
      this.state.x[slot] = endX;
      this.state.y[slot] = endY;
      this.state.z[slot] = endZ;
      this.state.travelledDistance[slot] = travelled + stepDistance;
      if ((this.state.travelledDistance[slot] ?? 0) >= projectile.maximumRange) {
        this.state.deactivate(slot);
      }
    }
    if (changed) {
      this.renderer.update();
      this.renderingDirty = false;
    }
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.renderer.dispose();
  }
}
