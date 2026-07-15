import { Material, type Asset } from 'cc';

/** 正式大厅可运行时加载的资源标识。 */
export enum LobbyResourceId {
  SurfaceMaterial = 'surface-material',
}

interface LobbyResourceDescriptor<TAsset extends Asset> {
  readonly path: string;
  readonly assetType: new (...args: never[]) => TAsset;
}

/** 集中保存 resources 相对路径，避免场景逻辑散落资源协议字符串。 */
export const LOBBY_RESOURCE_MANIFEST = {
  [LobbyResourceId.SurfaceMaterial]: {
    path: 'lobby/lobby-surface',
    assetType: Material,
  },
} as const satisfies Readonly<Record<LobbyResourceId, LobbyResourceDescriptor<Asset>>>;
