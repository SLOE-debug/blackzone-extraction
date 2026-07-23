import { type Node } from 'cc';
import { type WeaponEquipmentDefinition } from '../../../../../core/equipment/equipment';
import { type BattlefieldProjectileCollisionTarget } from '../model/battlefield-projectile-collision-target';
import {
  type MutableBattlefieldProjectileStatistics,
} from '../model/battlefield-projectile-statistics';
import { BattlefieldProjectileRenderer } from '../rendering/battlefield-projectile-renderer';
import { BattlefieldProjectileCombatPopulation } from './battlefield-projectile-combat-population';

export type { BattlefieldProjectileCollisionTarget } from '../model/battlefield-projectile-collision-target';

/** 组合纯弹丸战斗人口与 Cocos 批渲染适配器。 */
export class BattlefieldProjectilePopulation {
  private readonly combat: BattlefieldProjectileCombatPopulation;
  private readonly renderer: BattlefieldProjectileRenderer;
  private renderedRevision = -1;
  private disposed = false;

  constructor(
    parent: Node,
    weapon: Readonly<WeaponEquipmentDefinition>,
    statistics: MutableBattlefieldProjectileStatistics,
  ) {
    this.combat = new BattlefieldProjectileCombatPopulation(weapon, statistics);
    this.renderer = new BattlefieldProjectileRenderer(
      parent,
      this.combat.state,
      weapon.projectile.visual,
    );
  }

  public spawn(
    x: number,
    y: number,
    z: number,
    directionX: number,
    directionY: number,
    directionZ: number,
  ): void {
    if (!this.disposed) {
      this.combat.spawn(x, y, z, directionX, directionY, directionZ);
    }
  }

  public integrate(deltaTime: number): void {
    if (!this.disposed) {
      this.combat.integrate(deltaTime);
    }
  }

  public collide(targets: BattlefieldProjectileCollisionTarget): void {
    if (!this.disposed) {
      this.combat.collide(targets);
    }
  }

  public resolveImpacts(targets: BattlefieldProjectileCollisionTarget): void {
    if (!this.disposed) {
      this.combat.resolveImpacts(targets);
    }
  }

  /** 只在权威实体状态变化后把位置提交到动态 Mesh。 */
  public synchronizeRendering(): void {
    if (this.disposed || this.renderedRevision === this.combat.revision) {
      return;
    }
    this.renderer.update();
    this.renderedRevision = this.combat.revision;
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.renderer.dispose();
  }
}
