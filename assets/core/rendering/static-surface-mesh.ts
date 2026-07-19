import {
  type Material,
  Mesh,
  MeshRenderer,
  Node,
  utils,
} from 'cc';
import { type StaticSurfaceBufferGeometry } from '../geometry/buffer-geometry';

enum StaticSurfaceMeshState {
  Created,
  Initialized,
  Disposed,
}

/** 静态表面节点参与实时阴影的显式配置。 */
export interface StaticSurfaceMeshOptions {
  readonly castShadows: boolean;
  readonly receiveShadows: boolean;
  readonly uploadLightingAttributes: boolean;
}

/**
 * 把位置、法线和顶点色完整上传为静态 Cocos Mesh。
 *
 * 与动态批次不同，该适配器保留法线和 UV 流，供自定义受光材质使用。
 */
export class StaticSurfaceMesh {
  private state = StaticSurfaceMeshState.Created;
  private node: Node | null = null;
  private renderer: MeshRenderer | null = null;
  private mesh: Mesh | null = null;

  /** 创建带显式阴影策略的静态表面节点。 */
  public initialize(
    parent: Node,
    name: string,
    geometry: StaticSurfaceBufferGeometry,
    material: Material,
    options: Readonly<StaticSurfaceMeshOptions>,
  ): void {
    if (this.state !== StaticSurfaceMeshState.Created) {
      throw new Error('静态表面 Mesh 只能初始化一次。');
    }
    if (geometry.vertexCount <= 0 || geometry.indexCount <= 0) {
      throw new Error('静态表面 Mesh 要求非空几何。');
    }

    let mesh: Mesh | null = null;
    let node: Node | null = null;
    let renderer: MeshRenderer | null = null;
    try {
      const bounds = geometry.computeBounds();
      const commonGeometry = {
        positions: Array.from(geometry.getPositionView()),
        colors: Array.from(geometry.getColorView()),
        indices: Array.from(geometry.getIndexView()),
        minPos: { x: bounds.minX, y: bounds.minY, z: bounds.minZ },
        maxPos: { x: bounds.maxX, y: bounds.maxY, z: bounds.maxZ },
      };
      mesh = options.uploadLightingAttributes
        ? utils.MeshUtils.createMesh({
          ...commonGeometry,
          normals: Array.from(geometry.getNormalView()),
          uvs: Array.from(geometry.getUvView()),
        })
        : utils.MeshUtils.createMesh(commonGeometry);
      mesh.name = `${name}Mesh`;

      node = new Node(name);
      parent.addChild(node);
      renderer = node.addComponent(MeshRenderer);
      renderer.mesh = mesh;
      renderer.setMaterial(material, 0);
      renderer.shadowCastingMode = options.castShadows
        ? MeshRenderer.ShadowCastingMode.ON
        : MeshRenderer.ShadowCastingMode.OFF;
      renderer.receiveShadow = options.receiveShadows
        ? MeshRenderer.ShadowReceivingMode.ON
        : MeshRenderer.ShadowReceivingMode.OFF;
      renderer.onGeometryChanged();

      this.node = node;
      this.renderer = renderer;
      this.mesh = mesh;
      this.state = StaticSurfaceMeshState.Initialized;
    } catch (error: unknown) {
      this.state = StaticSurfaceMeshState.Disposed;
      if (renderer?.isValid === true) {
        renderer.mesh = null;
        renderer.setMaterial(null, 0);
      }
      mesh?.destroy();
      if (node?.isValid === true) {
        node.destroy();
      }
      throw error;
    }
  }

  /** 释放静态 Mesh、Renderer 节点和 GPU 资源。 */
  public dispose(): void {
    if (this.state === StaticSurfaceMeshState.Disposed) {
      return;
    }
    this.state = StaticSurfaceMeshState.Disposed;
    if (this.renderer?.isValid === true) {
      this.renderer.mesh = null;
      this.renderer.setMaterial(null, 0);
    }
    this.mesh?.destroy();
    if (this.node?.isValid === true) {
      this.node.destroy();
    }
    this.node = null;
    this.renderer = null;
    this.mesh = null;
  }
}
