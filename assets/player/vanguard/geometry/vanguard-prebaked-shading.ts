import { PrebakedFacetRole } from '../../../core/geometry/faceted/prebaked-facet-color';
import { VanguardMatteSurface } from './vanguard-surface';

/** 将主角表面语义映射为生成期分面结构角色。 */
export function getVanguardPrebakedFacetRole(
  surface: VanguardMatteSurface,
): PrebakedFacetRole {
  switch (surface) {
    case VanguardMatteSurface.FaceDetail:
    case VanguardMatteSurface.NeckSkin:
      return PrebakedFacetRole.Accent;
    case VanguardMatteSurface.FacialHair:
      return PrebakedFacetRole.Cavity;
    case VanguardMatteSurface.Skin:
    case VanguardMatteSurface.Hair:
    case VanguardMatteSurface.Headwear:
    case VanguardMatteSurface.Tunic:
    case VanguardMatteSurface.Mantle:
    case VanguardMatteSurface.Pants:
    case VanguardMatteSurface.Leather:
      return PrebakedFacetRole.Exterior;
    case VanguardMatteSurface.Count:
      throw new Error('主角表面计数不是可着色语义。');
  }
}
