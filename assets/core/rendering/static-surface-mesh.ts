import {
  type Material,
  Mesh,
  MeshRenderer,
  Node,
  utils,
} from 'cc';
import { type SurfaceBufferGeometry } from '../geometry/buffer-geometry';

enum StaticSurfaceMeshState {
  Created,
  Initialized,
  Disposed,
}

/**
 * 把位置、法线和顶点色完整上传为静态 Cocos Mesh。
 *
 * 与动态批次不同，该适配器保留法线流，供 Standard Effect 和实时光源使用。
 */
export class StaticSurfaceMesh {
  private state = StaticSurfaceMeshState.Created;
  private node: Node | null = null;
  private renderer: MeshRenderer | null = null;
  private mesh: Mesh | null = null;

  /** 创建支持实时光照和阴影的静态表面节点。 */
  public initialize(
    parent: Node,
    name: string,
    geometry: SurfaceBufferGeometry,
    material: Material,
  ): void {
    if (this.state !== StaticSurfaceMeshState.Created) {
      throw new Error('静态表面 Mesh 只能初始化一次。');
    }
    if (geometry.vertexCount <= 0 || geometry.indexCount <= 0) {
      throw new Error('静态表面 Mesh 要求非空几何。');
    }

    const bounds = geometry.computeBounds();
    // Standard Effect 即使关闭贴图仍保留 UV 输入，这里写入零值占位流。
    const uvs = new Array<number>(geometry.vertexCount * 2).fill(0);
    const mesh = utils.MeshUtils.createMesh({
      positions: Array.from(geometry.getPositionView()),
      normals: Array.from(geometry.getNormalView()),
      uvs,
      colors: Array.from(geometry.getColorView()),
      indices: Array.from(geometry.getIndexView()),
      minPos: { x: bounds.minX, y: bounds.minY, z: bounds.minZ },
      maxPos: { x: bounds.maxX, y: bounds.maxY, z: bounds.maxZ },
    });
    mesh.name = `${name}Mesh`;

    const node = new Node(name);
    parent.addChild(node);
    const renderer = node.addComponent(MeshRenderer);
    renderer.mesh = mesh;
    renderer.setMaterial(material, 0);
    renderer.shadowCastingMode = MeshRenderer.ShadowCastingMode.ON;
    renderer.receiveShadow = MeshRenderer.ShadowReceivingMode.ON;
    renderer.onGeometryChanged();

    this.node = node;
    this.renderer = renderer;
    this.mesh = mesh;
    this.state = StaticSurfaceMeshState.Initialized;
  }

  /** 释放静态 Mesh、Renderer 节点和 GPU 资源。 */
  public dispose(): void {
    if (this.state === StaticSurfaceMeshState.Disposed) {
      return;
    }
    if (this.renderer !== null) {
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
    this.state = StaticSurfaceMeshState.Disposed;
  }
}
