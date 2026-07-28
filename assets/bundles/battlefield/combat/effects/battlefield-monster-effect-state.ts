import { type BattlefieldMonsterTargetGroup } from '../../population/battlefield-monster-target-group';

/** 一个怪物群体的连续通用 Effect 数据。 */
export class BattlefieldMonsterEffectGroupState {
  public readonly lastHitSequence: Uint32Array;
  public readonly spinHitSkillSequence: Uint32Array;
  public readonly spinHitCount: Uint8Array;
  public readonly knockbackDirectionX: Float32Array;
  public readonly knockbackDirectionZ: Float32Array;
  public readonly knockbackSpeed: Float32Array;
  public readonly knockbackRemaining: Float32Array;
  public readonly knockbackDuration: Float32Array;
  public readonly movementSlowScale: Float32Array;
  public readonly movementSlowRemaining: Float32Array;
  public readonly elevation: Float32Array;
  public readonly verticalVelocity: Float32Array;
  public readonly airborneVelocityX: Float32Array;
  public readonly airborneVelocityZ: Float32Array;
  public readonly airborneHorizontalDrag: Float32Array;
  public readonly gravityScale: Float32Array;
  public readonly landingDamageBase: Float32Array;
  public readonly airborneActive: Uint8Array;
  public readonly kineticSequence: Uint32Array;
  public readonly kineticRemaining: Float32Array;
  public readonly kineticGeneration: Uint8Array;
  public readonly kineticDamageBudget: Float32Array;
  public readonly kineticBaseDamage: Float32Array;
  public readonly kineticActivatedFrame: Uint32Array;
  public readonly kineticSweepStartX: Float32Array;
  public readonly kineticSweepStartY: Float32Array;

  constructor(public readonly group: BattlefieldMonsterTargetGroup) {
    const count = group.crowdPopulation.count;
    this.lastHitSequence = new Uint32Array(count);
    this.spinHitSkillSequence = new Uint32Array(count);
    this.spinHitCount = new Uint8Array(count);
    this.knockbackDirectionX = new Float32Array(count);
    this.knockbackDirectionZ = new Float32Array(count);
    this.knockbackSpeed = new Float32Array(count);
    this.knockbackRemaining = new Float32Array(count);
    this.knockbackDuration = new Float32Array(count);
    this.movementSlowScale = new Float32Array(count);
    this.movementSlowRemaining = new Float32Array(count);
    this.elevation = new Float32Array(count);
    this.verticalVelocity = new Float32Array(count);
    this.airborneVelocityX = new Float32Array(count);
    this.airborneVelocityZ = new Float32Array(count);
    this.airborneHorizontalDrag = new Float32Array(count);
    this.gravityScale = new Float32Array(count);
    this.landingDamageBase = new Float32Array(count);
    this.airborneActive = new Uint8Array(count);
    this.kineticSequence = new Uint32Array(count);
    this.kineticRemaining = new Float32Array(count);
    this.kineticGeneration = new Uint8Array(count);
    this.kineticDamageBudget = new Float32Array(count);
    this.kineticBaseDamage = new Float32Array(count);
    this.kineticActivatedFrame = new Uint32Array(count);
    this.kineticSweepStartX = new Float32Array(count);
    this.kineticSweepStartY = new Float32Array(count);
    this.gravityScale.fill(1);
    this.movementSlowScale.fill(1);
  }
}

export function isValidEffectEntity(
  state: BattlefieldMonsterEffectGroupState,
  entityId: number,
): boolean {
  return Number.isSafeInteger(entityId)
    && entityId >= 0
    && entityId < state.group.crowdPopulation.count;
}
