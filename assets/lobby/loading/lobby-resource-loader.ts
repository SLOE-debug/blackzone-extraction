import { Material, resources } from 'cc';
import { LOBBY_RESOURCE_MANIFEST, LobbyResourceId } from './lobby-resource-manifest';

/** 加载大厅实时受光表面使用的 Standard 材质。 */
export function loadLobbySurfaceMaterial(): Promise<Material> {
  const descriptor = LOBBY_RESOURCE_MANIFEST[LobbyResourceId.SurfaceMaterial];
  return new Promise<Material>((resolve, reject) => {
    resources.load(descriptor.path, descriptor.assetType, (loadError, material) => {
      if (loadError) {
        reject(loadError);
        return;
      }
      resolve(material);
    });
  });
}
