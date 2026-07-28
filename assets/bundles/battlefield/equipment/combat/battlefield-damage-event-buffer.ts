/** 通用伤害结算所需的最小目标门面。 */
export interface BattlefieldDamageTarget {
  damageMonster(populationId: number, entityId: number, amount: number): boolean;
}

/** 数值化武器来源，供固定宽度 SoA 保存。 */
export enum BattlefieldWeaponSourceId {
  Sledgehammer,
  ReturningBow,
}

/** 通用伤害来源类别，不携带任何具体招式阶段。 */
export enum BattlefieldDamageKind {
  Physical,
  Projectile,
  Recall,
  Extraction,
  Tether,
  Explosion,
  Conductive,
}

/** 武器与统一效果结算之间的固定容量 Damage 事件 SoA。 */
export class BattlefieldDamageEventBuffer {
  public readonly sourceEntityId: Uint32Array;
  public readonly sourceWeaponId: Uint16Array;
  public readonly attackSequenceId: Uint32Array;
  public readonly targetPopulationId: Uint32Array;
  public readonly targetEntityId: Uint32Array;
  public readonly damage: Float32Array;
  public readonly damageKind: Uint8Array;
  public readonly hitPositionX: Float32Array;
  public readonly hitPositionY: Float32Array;
  public readonly hitPositionZ: Float32Array;
  private eventCount = 0;

  constructor(public readonly capacity = 512) {
    if (!Number.isSafeInteger(capacity) || capacity <= 0) {
      throw new Error('伤害事件缓冲容量必须为正安全整数。');
    }
    this.sourceEntityId = new Uint32Array(capacity);
    this.sourceWeaponId = new Uint16Array(capacity);
    this.attackSequenceId = new Uint32Array(capacity);
    this.targetPopulationId = new Uint32Array(capacity);
    this.targetEntityId = new Uint32Array(capacity);
    this.damage = new Float32Array(capacity);
    this.damageKind = new Uint8Array(capacity);
    this.hitPositionX = new Float32Array(capacity);
    this.hitPositionY = new Float32Array(capacity);
    this.hitPositionZ = new Float32Array(capacity);
  }

  public get count(): number {
    return this.eventCount;
  }

  public beginFrame(): void {
    this.eventCount = 0;
  }

  public append(event: Readonly<BattlefieldDamageEvent>): void {
    validateDamageEvent(event);
    if (this.eventCount >= this.capacity) {
      throw new Error('伤害事件缓冲容量不足。');
    }
    const index = this.eventCount++;
    this.sourceEntityId[index] = event.sourceEntityId;
    this.sourceWeaponId[index] = event.sourceWeaponId;
    this.attackSequenceId[index] = event.attackSequenceId;
    this.targetPopulationId[index] = event.targetPopulationId;
    this.targetEntityId[index] = event.targetEntityId;
    this.damage[index] = event.damage;
    this.damageKind[index] = event.damageKind;
    this.hitPositionX[index] = event.hitPositionX;
    this.hitPositionY[index] = event.hitPositionY;
    this.hitPositionZ[index] = event.hitPositionZ;
  }

  /** 在 PostSimulation 阶段按写入顺序统一路由伤害。 */
  public resolve(target: BattlefieldDamageTarget): number {
    let applied = 0;
    for (let index = 0; index < this.eventCount; index++) {
      if (target.damageMonster(
        this.targetPopulationId[index] ?? 0,
        this.targetEntityId[index] ?? 0,
        this.damage[index] ?? 0,
      )) {
        applied++;
      }
    }
    this.eventCount = 0;
    return applied;
  }
}

export interface BattlefieldDamageEvent {
  readonly sourceEntityId: number;
  readonly sourceWeaponId: number;
  readonly attackSequenceId: number;
  readonly targetPopulationId: number;
  readonly targetEntityId: number;
  readonly damage: number;
  readonly damageKind: BattlefieldDamageKind;
  readonly hitPositionX: number;
  readonly hitPositionY: number;
  readonly hitPositionZ: number;
}

function validateDamageEvent(event: Readonly<BattlefieldDamageEvent>): void {
  if (!Number.isFinite(event.sourceEntityId)
    || !Number.isFinite(event.sourceWeaponId)
    || !Number.isFinite(event.attackSequenceId)
    || !Number.isFinite(event.targetPopulationId)
    || !Number.isFinite(event.targetEntityId)
    || !Number.isFinite(event.damage)
    || !Number.isFinite(event.hitPositionX)
    || !Number.isFinite(event.hitPositionY)
    || !Number.isFinite(event.hitPositionZ)
    || !Number.isSafeInteger(event.attackSequenceId) || event.attackSequenceId <= 0
    || event.damage <= 0) {
    throw new Error('伤害事件参数无效。');
  }
}
