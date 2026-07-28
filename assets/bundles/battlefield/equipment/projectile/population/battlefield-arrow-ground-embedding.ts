import { BattlefieldArrowState } from '../model/battlefield-arrow-state';
import { type BattlefieldArrowPopulation } from './battlefield-arrow-population';

export const BATTLEFIELD_GROUNDED_ARROW_HEIGHT = 0.1;
const GROUNDED_DIRECTION_Y = -0.25;

/** 把箭固定在可见地表高度，并清理全部怪物槽位引用。 */
export function embedBattlefieldArrowInGround(
  arrows: BattlefieldArrowPopulation,
  index: number,
  groundY: number,
): void {
  arrows.positionY[index] = groundY + BATTLEFIELD_GROUNDED_ARROW_HEIGHT;
  const directionX = arrows.directionX[index] ?? 0;
  const directionZ = arrows.directionZ[index] ?? 1;
  const inverseLength = 1 / Math.max(
    0.0001,
    Math.hypot(directionX, GROUNDED_DIRECTION_Y, directionZ),
  );
  arrows.directionX[index] = directionX * inverseLength;
  arrows.directionY[index] = GROUNDED_DIRECTION_Y * inverseLength;
  arrows.directionZ[index] = directionZ * inverseLength;
  arrows.attachedPopulationId[index] = 0;
  arrows.attachedEntityId[index] = 0;
  arrows.attachmentOffsetX[index] = 0;
  arrows.attachmentOffsetY[index] = 0;
  arrows.attachmentOffsetZ[index] = 0;
  arrows.state[index] = BattlefieldArrowState.EmbeddedInWorld;
  arrows.dirty[index] = 1;
}
