import { VanguardAction } from '../../player/vanguard/model/vanguard-action';
import { type VanguardPopulationOptions } from '../../player/vanguard/model/vanguard-options';
import { LOBBY_LAYOUT } from './lobby-layout';

/** 大厅只拥有主角在祭台上的场景站位，不拥有角色模型实现。 */
export const LOBBY_VANGUARD_OPTIONS = Object.freeze({
  position: Object.freeze({
    x: 0,
    y: LOBBY_LAYOUT.altarTopY + 0.04,
    z: LOBBY_LAYOUT.focusZ,
  }),
  heading: 0,
  action: VanguardAction.Idle,
}) satisfies VanguardPopulationOptions;
