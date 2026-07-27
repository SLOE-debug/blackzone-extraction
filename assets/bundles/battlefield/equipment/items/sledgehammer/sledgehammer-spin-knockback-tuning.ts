import { SLEDGEHAMMER_PROGRESSION } from './sledgehammer-progression';

/** 单个旋风击退调参项的浏览器控件范围。 */
export interface SledgehammerSpinKnockbackTuningRange {
  readonly minimum: number;
  readonly maximum: number;
  readonly step: number;
}

/** 旋风击退结算实时读取的只读参数。 */
export interface SledgehammerSpinKnockbackValues {
  readonly impulse: number;
  readonly pulseMinimumScale: number;
  readonly pulseMaximumScale: number;
  readonly finalScale: number;
  readonly maximumSpeed: number;
  readonly durationSeconds: number;
  readonly pulseRadialWeight: number;
  readonly pulseTangentialWeight: number;
}

/** 右上角调试面板允许探索的旋风击退范围。 */
export const SLEDGEHAMMER_SPIN_KNOCKBACK_TUNING_RANGES = Object.freeze({
  impulse: Object.freeze({ minimum: 0, maximum: 40, step: 1 }),
  pulseMinimumScale: Object.freeze({ minimum: 0, maximum: 2, step: 0.05 }),
  pulseMaximumScale: Object.freeze({ minimum: 0, maximum: 3, step: 0.05 }),
  finalScale: Object.freeze({ minimum: 0, maximum: 4, step: 0.1 }),
  maximumSpeed: Object.freeze({ minimum: 5, maximum: 80, step: 1 }),
  durationSeconds: Object.freeze({ minimum: 0.1, maximum: 1.5, step: 0.05 }),
  pulseRadialWeight: Object.freeze({ minimum: 0, maximum: 1.5, step: 0.05 }),
  pulseTangentialWeight: Object.freeze({ minimum: 0, maximum: 1.5, step: 0.05 }),
}) satisfies Readonly<Record<keyof SledgehammerSpinKnockbackValues,
  Readonly<SledgehammerSpinKnockbackTuningRange>>>;

/** 保存单场战斗可实时调整的旋风击退参数，不修改正式成长配置。 */
export class SledgehammerSpinKnockbackTuning implements SledgehammerSpinKnockbackValues {
  private impulseValue = SLEDGEHAMMER_PROGRESSION.spinKnockbackImpulse;
  private pulseMinimumScaleValue = SLEDGEHAMMER_PROGRESSION.spinPulseMinimumKnockbackScale;
  private pulseMaximumScaleValue = SLEDGEHAMMER_PROGRESSION.spinPulseMaximumKnockbackScale;
  private finalScaleValue = SLEDGEHAMMER_PROGRESSION.spinFinalKnockbackScale;
  private maximumSpeedValue = SLEDGEHAMMER_PROGRESSION.spinMaximumKnockbackSpeed;
  private durationSecondsValue = SLEDGEHAMMER_PROGRESSION.spinKnockbackDurationSeconds;
  private pulseRadialWeightValue = SLEDGEHAMMER_PROGRESSION.spinPulseRadialWeight;
  private pulseTangentialWeightValue = SLEDGEHAMMER_PROGRESSION.spinPulseTangentialWeight;

  public get impulse(): number { return this.impulseValue; }
  public get pulseMinimumScale(): number { return this.pulseMinimumScaleValue; }
  public get pulseMaximumScale(): number { return this.pulseMaximumScaleValue; }
  public get finalScale(): number { return this.finalScaleValue; }
  public get maximumSpeed(): number { return this.maximumSpeedValue; }
  public get durationSeconds(): number { return this.durationSecondsValue; }
  public get pulseRadialWeight(): number { return this.pulseRadialWeightValue; }
  public get pulseTangentialWeight(): number { return this.pulseTangentialWeightValue; }

  public setImpulse(value: number): void {
    this.impulseValue = validateTuningValue('基础冲量', value, 'impulse');
  }

  public setPulseMinimumScale(value: number): void {
    this.pulseMinimumScaleValue = validateTuningValue(
      '前段倍率',
      value,
      'pulseMinimumScale',
    );
  }

  public setPulseMaximumScale(value: number): void {
    this.pulseMaximumScaleValue = validateTuningValue(
      '后段倍率',
      value,
      'pulseMaximumScale',
    );
  }

  public setFinalScale(value: number): void {
    this.finalScaleValue = validateTuningValue('终结倍率', value, 'finalScale');
  }

  public setMaximumSpeed(value: number): void {
    this.maximumSpeedValue = validateTuningValue('速度上限', value, 'maximumSpeed');
  }

  public setDurationSeconds(value: number): void {
    this.durationSecondsValue = validateTuningValue('持续时间', value, 'durationSeconds');
  }

  public setPulseRadialWeight(value: number): void {
    this.pulseRadialWeightValue = validateTuningValue(
      '径向权重',
      value,
      'pulseRadialWeight',
    );
  }

  public setPulseTangentialWeight(value: number): void {
    this.pulseTangentialWeightValue = validateTuningValue(
      '切向权重',
      value,
      'pulseTangentialWeight',
    );
  }

  /** 返回供调试面板初始化显示的不可变快照。 */
  public getSnapshot(): Readonly<SledgehammerSpinKnockbackValues> {
    return Object.freeze({
      impulse: this.impulse,
      pulseMinimumScale: this.pulseMinimumScale,
      pulseMaximumScale: this.pulseMaximumScale,
      finalScale: this.finalScale,
      maximumSpeed: this.maximumSpeed,
      durationSeconds: this.durationSeconds,
      pulseRadialWeight: this.pulseRadialWeight,
      pulseTangentialWeight: this.pulseTangentialWeight,
    });
  }
}

function validateTuningValue(
  label: string,
  value: number,
  key: keyof SledgehammerSpinKnockbackValues,
): number {
  const range = SLEDGEHAMMER_SPIN_KNOCKBACK_TUNING_RANGES[key];
  if (!Number.isFinite(value) || value < range.minimum || value > range.maximum) {
    throw new Error(`旋风击退${label}超出调试范围。`);
  }
  return value;
}
