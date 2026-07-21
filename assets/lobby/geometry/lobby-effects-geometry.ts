import { lobbyEmissiveGeometry } from './lobby-emissive-geometry';
import { lobbyTransparentGeometry } from './lobby-transparent-geometry';

/**
 * 大厅非受光效果面的几何来源。
 *
 * 发光面必须进入写深度的不透明批次，观察玻璃必须进入关闭深度写入的透明批次；
 * 此清单只负责统一发现两类来源，不再提供能够误合批的组合写入入口。
 */
export const lobbyEffectsGeometry = Object.freeze({
  emissive: lobbyEmissiveGeometry,
  glass: lobbyTransparentGeometry,
});
