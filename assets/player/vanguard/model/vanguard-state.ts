import { EntityTable } from '../../../core/entities/entity-table';
import { VANGUARD_CONFIG } from './vanguard-config';
import {
  type VanguardPopulationOptions,
  validateVanguardOptions,
} from './vanguard-options';
import {
  VANGUARD_SCHEMA,
  type VanguardData,
  type VanguardTable,
} from './vanguard-schema';

/** 聚合可复用主角的单实体 SoA 状态。 */
export class VanguardState {
  public readonly table: VanguardTable;
  public readonly data: VanguardData;

  constructor(options: Readonly<VanguardPopulationOptions>) {
    validateVanguardOptions(options);
    this.table = new EntityTable(VANGUARD_SCHEMA, 1);
    this.table.allocate();
    this.data = this.table.data;
    initializeVanguardData(this.data, options);
  }

  /** 当前活动主角实体数量。 */
  public get count(): number {
    return this.table.count;
  }
}

/** 写入调用场景提供的初始位置、动作和稳定形态。 */
function initializeVanguardData(
  data: VanguardData,
  options: Readonly<VanguardPopulationOptions>,
): void {
  const { transform, morphology, intent, animation } = data;
  transform.x[0] = options.position.x;
  transform.y[0] = options.position.y;
  transform.z[0] = options.position.z;
  transform.heading[0] = options.heading;

  morphology.scale[0] = VANGUARD_CONFIG.scale;

  intent.action[0] = options.action;
  animation.idlePhase[0] = 0;
}
