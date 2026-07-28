import { BattlefieldArrowState } from '../model/battlefield-arrow-state';
import {
  BATTLEFIELD_ARROW_CAPACITY,
  type BattlefieldArrowPopulation,
} from './battlefield-arrow-population';

/** 推进直线去程并在射程耗尽时把箭固定为世界锚点。 */
export class BattlefieldArrowFlightSystem {
  public update(arrows: BattlefieldArrowPopulation, deltaTime: number, groundY = 0): void {
    const safeDelta = Math.max(0, Math.min(deltaTime, 0.05));
    for (let index = 0; index < BATTLEFIELD_ARROW_CAPACITY; index++) {
      if (arrows.active[index] === 0 || arrows.state[index] !== BattlefieldArrowState.Flying) {
        continue;
      }
      const x = arrows.positionX[index] ?? 0;
      const y = arrows.positionY[index] ?? 0;
      const z = arrows.positionZ[index] ?? 0;
      arrows.previousX[index] = x;
      arrows.previousY[index] = y;
      arrows.previousZ[index] = z;
      const travel = Math.min(arrows.remainingRange[index] ?? 0, (arrows.speed[index] ?? 0) * safeDelta);
      arrows.positionX[index] = x + (arrows.directionX[index] ?? 0) * travel;
      arrows.positionY[index] = y + (arrows.directionY[index] ?? 0) * travel;
      arrows.positionZ[index] = z + (arrows.directionZ[index] ?? 0) * travel;
      arrows.remainingRange[index] = Math.max(0, (arrows.remainingRange[index] ?? 0) - travel);
      arrows.dirty[index] = 1;
      if ((arrows.remainingRange[index] ?? 0) <= 0) {
        arrows.positionY[index] = groundY;
        arrows.state[index] = BattlefieldArrowState.EmbeddedInWorld;
      }
    }
  }
}
