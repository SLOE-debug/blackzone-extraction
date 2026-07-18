import { Color, type Material } from 'cc';
import { StandardVertexColorMaterialFactory } from '../../../../core/rendering/standard-vertex-color-material-factory';
import { UnlitMaterialFactory } from '../../../../core/rendering/unlit-material-factory';
import { BattlefieldEnvironmentMaterialKind } from '../model/battlefield-environment-material-kind';

const BATTLEFIELD_ENVIRONMENT_MATERIAL_KINDS = Object.freeze([
  BattlefieldEnvironmentMaterialKind.Organic,
  BattlefieldEnvironmentMaterialKind.Mineral,
  BattlefieldEnvironmentMaterialKind.Metal,
  BattlefieldEnvironmentMaterialKind.Glow,
  BattlefieldEnvironmentMaterialKind.Pool,
] as const);

/** 管理环境批次共享的少量材质实例。 */
export class BattlefieldEnvironmentMaterials {
  private readonly materials: Readonly<Record<BattlefieldEnvironmentMaterialKind, Material>>;
  private disposed = false;

  constructor(surfaceMaterialTemplate: Material) {
    const owned: Material[] = [];
    try {
      const organic = StandardVertexColorMaterialFactory.create(
        surfaceMaterialTemplate,
        {
          name: 'BattlefieldEnvironmentOrganic',
          mainColor: new Color(255, 255, 255, 255),
          roughness: 0.92,
          metallic: 0,
          specularIntensity: 0.14,
          emissive: new Color(0, 0, 0, 255),
        },
      );
      owned.push(organic);
      const mineral = StandardVertexColorMaterialFactory.create(
        surfaceMaterialTemplate,
        {
          name: 'BattlefieldEnvironmentMineral',
          mainColor: new Color(255, 255, 255, 255),
          roughness: 0.76,
          metallic: 0.08,
          specularIntensity: 0.34,
          emissive: new Color(0, 0, 0, 255),
        },
      );
      owned.push(mineral);
      const metal = StandardVertexColorMaterialFactory.create(
        surfaceMaterialTemplate,
        {
          name: 'BattlefieldEnvironmentMetal',
          mainColor: new Color(255, 255, 255, 255),
          roughness: 0.62,
          metallic: 0.58,
          specularIntensity: 0.68,
          emissive: new Color(0, 0, 0, 255),
        },
      );
      owned.push(metal);
      const glow = UnlitMaterialFactory.create(
        'BattlefieldEnvironmentGlow',
        {
          mainColor: new Color(255, 255, 255, 255),
          useVertexColor: true,
        },
      );
      owned.push(glow);
      const pool = StandardVertexColorMaterialFactory.create(
        surfaceMaterialTemplate,
        {
          name: 'BattlefieldEnvironmentPool',
          mainColor: new Color(255, 255, 255, 255),
          roughness: 0.18,
          metallic: 0.04,
          specularIntensity: 0.92,
          emissive: new Color(8, 28, 22, 255),
        },
      );
      owned.push(pool);
      this.materials = Object.freeze({
        [BattlefieldEnvironmentMaterialKind.Organic]: organic,
        [BattlefieldEnvironmentMaterialKind.Mineral]: mineral,
        [BattlefieldEnvironmentMaterialKind.Metal]: metal,
        [BattlefieldEnvironmentMaterialKind.Glow]: glow,
        [BattlefieldEnvironmentMaterialKind.Pool]: pool,
      });
    } catch (error: unknown) {
      for (const material of owned) {
        material.destroy();
      }
      throw error;
    }
  }

  /** 返回指定稳定材质类别的共享实例。 */
  public get(kind: BattlefieldEnvironmentMaterialKind): Material {
    return this.materials[kind];
  }

  /** 释放全部环境材质。 */
  public dispose(): void {
    if (this.disposed) {
      return;
    }
    for (const kind of BATTLEFIELD_ENVIRONMENT_MATERIAL_KINDS) {
      this.materials[kind].destroy();
    }
    this.disposed = true;
  }
}
