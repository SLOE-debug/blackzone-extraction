import { EquipmentId } from '../catalog/equipment-id';
import {
  evaluateLootScatterTrajectory,
  LootScatterPhase,
  type LootScatterTrajectory,
  type MutableLootScatterPose,
} from '../../loot/model/loot-scatter-trajectory';

/** 一件装备从延迟起飞到静止落地的独立运行时。 */
export class DroppedEquipmentRuntime {
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
    public readonly instanceId: number,
    public readonly equipmentId: EquipmentId,
    private readonly trajectory: Readonly<LootScatterTrajectory>,
  ) {
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

  public get visible(): boolean {
    return this.phase !== LootScatterPhase.Waiting;
  }

  public get rotationX(): number {
    return this.pose.rotationX;
  }

  public get rotationY(): number {
    return this.pose.rotationY;
  }

  public get rotationZ(): number {
    return this.pose.rotationZ;
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
  }

  private writePose(): void {
    this.phase = evaluateLootScatterTrajectory(this.trajectory, this.elapsed, this.pose);
  }
}
