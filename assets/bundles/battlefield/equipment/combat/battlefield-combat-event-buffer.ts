/** 大锤命中后需要结算的效果组合。 */
export enum BattlefieldWeaponHitKind {
  Swing,
  Uppercut,
  SpinPulse,
  SpinFinal,
}

/** 预分配的近战命中事件 SoA，统一把查询与伤害结算解耦。 */
export class BattlefieldCombatEventBuffer {
  public readonly kind: Uint8Array;
  public readonly attackSequenceId: Uint32Array;
  public readonly populationId: Uint32Array;
  public readonly entityId: Uint32Array;
  public readonly directionX: Float32Array;
  public readonly directionZ: Float32Array;
  public readonly damage: Float32Array;
  public readonly knockbackSpeed: Float32Array;
  public readonly knockbackDuration: Float32Array;
  public readonly launchVelocity: Float32Array;
  public readonly magnetizedSkillSequence: Uint32Array;
  public readonly magnetizedDuration: Float32Array;
  private eventCount = 0;

  constructor(public readonly capacity = 512) {
    if (!Number.isSafeInteger(capacity) || capacity <= 0) {
      throw new Error('战斗事件缓冲容量必须为正安全整数。');
    }
    this.kind = new Uint8Array(capacity);
    this.attackSequenceId = new Uint32Array(capacity);
    this.populationId = new Uint32Array(capacity);
    this.entityId = new Uint32Array(capacity);
    this.directionX = new Float32Array(capacity);
    this.directionZ = new Float32Array(capacity);
    this.damage = new Float32Array(capacity);
    this.knockbackSpeed = new Float32Array(capacity);
    this.knockbackDuration = new Float32Array(capacity);
    this.launchVelocity = new Float32Array(capacity);
    this.magnetizedSkillSequence = new Uint32Array(capacity);
    this.magnetizedDuration = new Float32Array(capacity);
  }

  public get count(): number {
    return this.eventCount;
  }

  public beginFrame(): void {
    this.eventCount = 0;
  }

  public append(event: Readonly<BattlefieldCombatEvent>): void {
    validateEvent(event);
    if (this.eventCount >= this.capacity) {
      throw new Error('战斗事件缓冲容量不足。');
    }
    const index = this.eventCount++;
    this.kind[index] = event.kind;
    this.attackSequenceId[index] = event.attackSequenceId;
    this.populationId[index] = event.populationId;
    this.entityId[index] = event.entityId;
    this.directionX[index] = event.directionX;
    this.directionZ[index] = event.directionZ;
    this.damage[index] = event.damage;
    this.knockbackSpeed[index] = event.knockbackSpeed;
    this.knockbackDuration[index] = event.knockbackDuration;
    this.launchVelocity[index] = event.launchVelocity;
    this.magnetizedSkillSequence[index] = event.magnetizedSkillSequence;
    this.magnetizedDuration[index] = event.magnetizedDuration;
  }
}

export interface BattlefieldCombatEvent {
  readonly kind: BattlefieldWeaponHitKind;
  readonly attackSequenceId: number;
  readonly populationId: number;
  readonly entityId: number;
  readonly directionX: number;
  readonly directionZ: number;
  readonly damage: number;
  readonly knockbackSpeed: number;
  readonly knockbackDuration: number;
  readonly launchVelocity: number;
  readonly magnetizedSkillSequence: number;
  readonly magnetizedDuration: number;
}

function validateEvent(event: Readonly<BattlefieldCombatEvent>): void {
  if (![event.attackSequenceId, event.populationId, event.entityId,
    event.directionX, event.directionZ, event.damage, event.knockbackSpeed,
    event.knockbackDuration, event.launchVelocity, event.magnetizedSkillSequence,
    event.magnetizedDuration].every(Number.isFinite)
    || !Number.isSafeInteger(event.attackSequenceId) || event.attackSequenceId <= 0
    || event.damage <= 0
    || event.knockbackSpeed < 0
    || event.knockbackDuration <= 0
    || event.launchVelocity < 0
    || Math.abs(Math.hypot(event.directionX, event.directionZ) - 1) > 0.001) {
    throw new Error('近战命中事件参数无效。');
  }
}
