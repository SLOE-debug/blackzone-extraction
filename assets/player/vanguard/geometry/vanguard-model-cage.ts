import { mergeVanguardCages } from './vanguard-cage';
import { VANGUARD_BODY_CAGE } from './vanguard-body-cage';
import { VANGUARD_HAIR_CAGE } from './vanguard-hair-cage';
import { VANGUARD_HEADWEAR_CAGE } from './vanguard-headwear-cage';
import { offsetVanguardMantleControlBinding } from './vanguard-mantle-control-binding';
import {
  VANGUARD_MANTLE_CAGE,
  VANGUARD_MANTLE_LOCAL_CONTROL_BINDING,
} from './vanguard-mantle-cage';
import { VANGUARD_OUTFIT_CAGE } from './vanguard-outfit-cage';
import { VanguardMatteSurface } from './vanguard-surface';

const VANGUARD_MANTLE_CONTROL_VERTEX_OFFSET = VANGUARD_BODY_CAGE.vertices.length
  + VANGUARD_OUTFIT_CAGE.vertices.length
  + VANGUARD_HAIR_CAGE.vertices.length
  + VANGUARD_HEADWEAR_CAGE.vertices.length;

/** 自由披片在合并后人物控制笼中的全局覆盖关系。 */
export const VANGUARD_MANTLE_CONTROL_BINDING = offsetVanguardMantleControlBinding(
  VANGUARD_MANTLE_LOCAL_CONTROL_BINDING,
  VANGUARD_MANTLE_CONTROL_VERTEX_OFFSET,
);

/** 合并人体、面部、衣物、头发、帽子和披肩后的哑光层拓扑笼。 */
export const VANGUARD_MATTE_CAGE = mergeVanguardCages(
  [
    VANGUARD_BODY_CAGE,
    VANGUARD_OUTFIT_CAGE,
    VANGUARD_HAIR_CAGE,
    VANGUARD_HEADWEAR_CAGE,
    VANGUARD_MANTLE_CAGE,
  ],
  VanguardMatteSurface.Count,
);
