const EMPTY_SEQUENCE = 0;

/** 单个实体对在一次技能中的传播冷却与伤害去重结果。 */
export interface BattlefieldKineticPairResolution {
  readonly propagationAllowed: boolean;
  readonly damageAllowed: boolean;
}

/**
 * 使用固定容量开放寻址表记录动量碰撞实体对。
 *
 * 热路径不创建 Set、对象或临时数组；新技能开始时直接清空连续 TypedArray。
 */
export class BattlefieldKineticPairLedger implements BattlefieldKineticPairResolution {
  private readonly firstPopulation: Uint32Array;
  private readonly firstEntity: Uint32Array;
  private readonly secondPopulation: Uint32Array;
  private readonly secondEntity: Uint32Array;
  private readonly sequence: Uint32Array;
  private readonly lastCollisionTime: Float32Array;
  private readonly damageApplied: Uint8Array;
  private activeSequence = EMPTY_SEQUENCE;
  private resolutionPropagationAllowed = false;
  private resolutionDamageAllowed = false;

  public get propagationAllowed(): boolean {
    return this.resolutionPropagationAllowed;
  }

  public get damageAllowed(): boolean {
    return this.resolutionDamageAllowed;
  }

  constructor(private readonly capacity: number) {
    if (!Number.isSafeInteger(capacity) || capacity <= 0 || (capacity & (capacity - 1)) !== 0) {
      throw new Error('动量碰撞账本容量必须是二的正整数次幂。');
    }
    this.firstPopulation = new Uint32Array(capacity);
    this.firstEntity = new Uint32Array(capacity);
    this.secondPopulation = new Uint32Array(capacity);
    this.secondEntity = new Uint32Array(capacity);
    this.sequence = new Uint32Array(capacity);
    this.lastCollisionTime = new Float32Array(capacity);
    this.damageApplied = new Uint8Array(capacity);
  }

  /** 切换技能时复用全部存储并清空旧实体对。 */
  public beginSequence(skillSequenceId: number): void {
    if (!Number.isSafeInteger(skillSequenceId) || skillSequenceId <= 0) {
      throw new Error('动量碰撞技能序列必须是正安全整数。');
    }
    if (this.activeSequence === skillSequenceId) {
      return;
    }
    this.activeSequence = skillSequenceId;
    this.sequence.fill(EMPTY_SEQUENCE);
    this.damageApplied.fill(0);
  }

  /** 返回本次接触是否允许传播，以及是否仍可首次造成碰撞伤害。 */
  public resolve(
    firstPopulationId: number,
    firstEntityId: number,
    secondPopulationId: number,
    secondEntityId: number,
    skillSequenceId: number,
    elapsedSeconds: number,
    cooldownSeconds: number,
  ): Readonly<BattlefieldKineticPairResolution> {
    this.beginSequence(skillSequenceId);
    let firstPopulation = firstPopulationId;
    let firstEntity = firstEntityId;
    let secondPopulation = secondPopulationId;
    let secondEntity = secondEntityId;
    if (isAfter(firstPopulation, firstEntity, secondPopulation, secondEntity)) {
      firstPopulation = secondPopulationId;
      firstEntity = secondEntityId;
      secondPopulation = firstPopulationId;
      secondEntity = firstEntityId;
    }
    let slot = hashPair(firstPopulation, firstEntity, secondPopulation, secondEntity)
      & (this.capacity - 1);
    for (let probe = 0; probe < this.capacity; probe++) {
      const sequence = this.sequence[slot] ?? EMPTY_SEQUENCE;
      if (sequence === EMPTY_SEQUENCE) {
        this.sequence[slot] = skillSequenceId;
        this.firstPopulation[slot] = firstPopulation;
        this.firstEntity[slot] = firstEntity;
        this.secondPopulation[slot] = secondPopulation;
        this.secondEntity[slot] = secondEntity;
        this.lastCollisionTime[slot] = elapsedSeconds;
        this.damageApplied[slot] = 1;
        return this.writeResolution(true, true);
      }
      if ((this.firstPopulation[slot] ?? 0) === firstPopulation
        && (this.firstEntity[slot] ?? 0) === firstEntity
        && (this.secondPopulation[slot] ?? 0) === secondPopulation
        && (this.secondEntity[slot] ?? 0) === secondEntity) {
        const propagationAllowed = elapsedSeconds - (this.lastCollisionTime[slot] ?? 0)
          >= cooldownSeconds;
        if (propagationAllowed) {
          this.lastCollisionTime[slot] = elapsedSeconds;
        }
        const damageAllowed = (this.damageApplied[slot] ?? 0) === 0;
        if (damageAllowed) {
          this.damageApplied[slot] = 1;
        }
        return this.writeResolution(propagationAllowed, damageAllowed);
      }
      slot = (slot + 1) & (this.capacity - 1);
    }
    throw new Error('动量碰撞账本容量不足。');
  }

  private writeResolution(
    propagationAllowed: boolean,
    damageAllowed: boolean,
  ): Readonly<BattlefieldKineticPairResolution> {
    this.resolutionPropagationAllowed = propagationAllowed;
    this.resolutionDamageAllowed = damageAllowed;
    return this;
  }
}

function isAfter(
  firstPopulation: number,
  firstEntity: number,
  secondPopulation: number,
  secondEntity: number,
): boolean {
  return firstPopulation > secondPopulation
    || (firstPopulation === secondPopulation && firstEntity > secondEntity);
}

function hashPair(
  firstPopulation: number,
  firstEntity: number,
  secondPopulation: number,
  secondEntity: number,
): number {
  let hash = Math.imul(firstPopulation + 1, 0x9e3779b1);
  hash ^= Math.imul(firstEntity + 1, 0x85ebca6b);
  hash ^= Math.imul(secondPopulation + 1, 0xc2b2ae35);
  hash ^= Math.imul(secondEntity + 1, 0x27d4eb2f);
  return hash >>> 0;
}
