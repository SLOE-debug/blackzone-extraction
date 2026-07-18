import { Node } from 'cc';
import { ScreenUiCanvas } from '../../core/ui/screen-ui-canvas';

/** 为大厅提供带稳定节点名称的屏幕空间 Canvas 门面。 */
export class LobbyUiCanvas extends ScreenUiCanvas {
  constructor(parent: Node) {
    super(parent, 'LobbyUiCanvas');
  }
}
