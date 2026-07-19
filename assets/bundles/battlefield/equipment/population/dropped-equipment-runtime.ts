import { type Material, Node } from 'cc';
import { EquipmentId } from '../../../../core/equipment/equipment';
import {
  evaluateLootScatterTrajectory,
  LootScatterPhase,
  type LootScatterTrajectory,
  type MutableLootScatterPose,
} from '../../loot/model/loot-scatter-trajectory';
import { DroppedEquipmentRenderer } from '../rendering/dropped-equipment-renderer';

/** 一件装备从延迟起飞到静止落地的独立运行时。 */
export class DroppedEquipmentRuntime {
  private readonly renderer: DroppedEquipmentRenderer;
  private readonly pose: MutableLootScatterPose = {
    x: 0,
    y: 0,
    z: 0,
    rotationX: 0,
    rotationY: 0,
    rotationZ: 0,
  };
  private phase = LootScatterPhase.Waiting;
  private elapsed = 0;
  private disposed = false;

  constructor(
    parent: Node,
    material: Material,
    public readonly instanceId: number,
    public readonly equipmentId: EquipmentId,
    private readonly trajectory: Readonly<LootScatterTrajectory>,
  ) {
    this.renderer = new DroppedEquipmentRenderer(parent, equipmentId, material);
    this.writePose();
  }

  public get x(): number {
    return this.pose.x;
  }

  public get y(): number {
    return this.pose.y;
  }

  public get z(): number {
    return this.pose.z;
  }

  public get landed(): boolean {
    return this.phase === LootScatterPhase.Landed;
  }

  /** 推进抛物线、触地缓冲和最终静止状态。 */
  public update(deltaTime: number): void {
    if (this.disposed || this.phase === LootScatterPhase.Landed) {
      return;
    }
    this.elapsed += Math.max(0, Math.min(deltaTime, 0.05));
    this.writePose();
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.renderer.dispose();
  }

  private writePose(): void {
    this.phase = evaluateLootScatterTrajectory(this.trajectory, this.elapsed, this.pose);
    this.renderer.setVisible(this.phase !== LootScatterPhase.Waiting);
    this.renderer.setPose(
      this.pose.x,
      this.pose.y,
      this.pose.z,
      this.pose.rotationX,
      this.pose.rotationY,
      this.pose.rotationZ,
    );
  }
}
