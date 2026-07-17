import { type SurfaceBufferGeometry } from '../geometry/buffer-geometry';

/**
 * 动态表面网格可由 Evaluator 原地写入的有效顶点流。
 *
 * 每个数组都是 SurfaceBufferGeometry 当前有效范围的零拷贝视图，不拥有缓冲区。
 */
export interface VertexStreams {
  /** 每个顶点三个分量的位置流。 */
  readonly positions: Float32Array;
  /** 每个顶点三个分量的单位法线流。 */
  readonly normals: Float32Array;
  /** 每个顶点四个分量的线性 RGBA 颜色流。 */
  readonly colors: Float32Array;
}

/**
 * 从已经提交有效计数的表面几何创建运行时顶点流视图。
 *
 * @param geometry 提供底层强类型缓冲的表面几何。
 * @returns 与几何有效顶点范围共享底层 ArrayBuffer 的只读流集合。
 */
export function createVertexStreams(geometry: SurfaceBufferGeometry): VertexStreams {
  return Object.freeze({
    positions: geometry.getPositionView(),
    normals: geometry.getNormalView(),
    colors: geometry.getColorView(),
  });
}
