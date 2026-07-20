import { type GridPointSampler } from '../../../core/geometry/grid/flat-grid-emitter';
import { type FlatGridPositionArray } from '../../../core/geometry/grid/flat-grid-workspace';
import {
  type BattlefieldGroundPatchFrame,
  type BattlefieldGroundPoint,
  sampleBattlefieldGroundPoint,
} from './battlefield-ground-sampling';

/** 把 Patch 内相对列行映射到确定性绝对世界格点。 */
class BattlefieldGroundGridSampler
implements GridPointSampler<BattlefieldGroundPatchFrame> {
  private readonly sampledPoint: BattlefieldGroundPoint = { x: 0, y: 0, z: 0 };

  public sample(
    frame: Readonly<BattlefieldGroundPatchFrame>,
    column: number,
    row: number,
    output: FlatGridPositionArray,
    outputOffset: number,
  ): void {
    const globalColumn = frame.firstGlobalColumn + column;
    const globalRow = frame.firstGlobalRow + row;
    sampleBattlefieldGroundPoint(globalColumn, globalRow, frame, this.sampledPoint);
    output[outputOffset] = this.sampledPoint.x;
    output[outputOffset + 1] = this.sampledPoint.y;
    output[outputOffset + 2] = this.sampledPoint.z;
  }
}

/** Ground Geometry 长期复用的世界格点采样器。 */
export const battlefieldGroundGridSampler: GridPointSampler<BattlefieldGroundPatchFrame> =
  new BattlefieldGroundGridSampler();
