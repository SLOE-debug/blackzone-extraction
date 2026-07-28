import {
  type BattlefieldArrowCombatTarget,
  type MutableBattlefieldArrowTargetPose,
} from '../model/battlefield-arrow-query';
import { BattlefieldArrowState } from '../model/battlefield-arrow-state';
import {
  BATTLEFIELD_ARROW_CAPACITY,
  type BattlefieldArrowPopulation,
} from './battlefield-arrow-population';
import { embedBattlefieldArrowInGround } from './battlefield-arrow-ground-embedding';

/** 让怪物附着箭跟随目标；目标失效时安全转换为地面锚点。 */
export class BattlefieldArrowAttachmentSystem {
  private readonly pose: MutableBattlefieldArrowTargetPose = {
    centerX: 0,
    centerY: 0,
    centerZ: 0,
    radius: 0,
    halfHeight: 0,
  };

  public update(
    arrows: BattlefieldArrowPopulation,
    target: BattlefieldArrowCombatTarget,
    groundY = 0,
  ): void {
    for (let index = 0; index < BATTLEFIELD_ARROW_CAPACITY; index++) {
      if (arrows.state[index] !== BattlefieldArrowState.EmbeddedInMonster) {
        continue;
      }
      if (!target.writeArrowTargetPose(
        arrows.attachedPopulationId[index] ?? 0,
        arrows.attachedEntityId[index] ?? 0,
        this.pose,
      )) {
        embedBattlefieldArrowInGround(arrows, index, groundY);
        continue;
      }
      arrows.positionX[index] = this.pose.centerX + (arrows.attachmentOffsetX[index] ?? 0);
      arrows.positionY[index] = this.pose.centerY + (arrows.attachmentOffsetY[index] ?? 0);
      arrows.positionZ[index] = this.pose.centerZ + (arrows.attachmentOffsetZ[index] ?? 0);
      arrows.dirty[index] = 1;
    }
  }
}
